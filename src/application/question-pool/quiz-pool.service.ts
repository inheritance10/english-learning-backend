import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuizQuestionEntity, QuestionType } from '../../domain/entities/quiz-question.entity';
import { UserSeenQuestionEntity } from '../../domain/entities/user-seen-question.entity';
import { TopicEntity } from '../../domain/entities/topic.entity';
import { GeminiService } from '../../infrastructure/gemini/gemini.service';
import { QuestionPoolScheduler, MIN_POOL_SIZE } from './question-pool.scheduler';

/** Havuzdan sunulan sorunun süresi (gün). */
const SEEN_EXPIRY_DAYS = 30;

/** Havuzda kalan soru bu eşiğin altına düşerse on-demand refill tetiklenir. */
const REFILL_TRIGGER_THRESHOLD = 10;

export interface PooledQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  hint: string;
  grammar_point: string;
  /** Kaynağı: 'pool' → DB'den, 'gemini' → anlık AI üretim */
  source: 'pool' | 'gemini';
}

/**
 * Soru havuzu servis katmanı.
 *
 * Önce `quiz_questions` tablosundan kullanıcının daha önce görmediği
 * (ya da 30 günü geçmiş) soruları çeker.
 * Havuz yetersizse Gemini'ye düşer ve üretilen soruları async kaydeder.
 */
@Injectable()
export class QuizPoolService {
  private readonly logger = new Logger(QuizPoolService.name);

  constructor(
    @InjectRepository(QuizQuestionEntity)
    private readonly questionRepo: Repository<QuizQuestionEntity>,
    @InjectRepository(UserSeenQuestionEntity)
    private readonly seenRepo: Repository<UserSeenQuestionEntity>,
    @InjectRepository(TopicEntity)
    private readonly topicRepo: Repository<TopicEntity>,
    private readonly gemini: GeminiService,
    private readonly scheduler: QuestionPoolScheduler,
  ) {}

  /**
   * Kullanıcıya quiz soruları servisi.
   *
   * @param userId      İstekte bulunan kullanıcı
   * @param topicId     Seçilen topic UUID
   * @param topicName   Gemini fallback için topic adı
   * @param cefrLevel   Kullanıcının CEFR seviyesi
   * @param count       İstenen soru sayısı
   * @param interests   Kullanıcı ilgi alanları (Gemini fallback'de kullanılır)
   * @param language    Açıklama dili
   */
  async serve(params: {
    userId: string;
    topicId: string;
    topicName: string;
    cefrLevel: string;
    count: number;
    interests: string[];
    language: 'en' | 'tr';
  }): Promise<PooledQuestion[]> {
    const { userId, topicId, topicName, cefrLevel, count, interests, language } = params;

    // ── 1. DB havuzundan kullanıcının görmediği soruları çek ─────────────
    const poolQuestions = await this.fetchFromPool(userId, topicId, cefrLevel, count);

    if (poolQuestions.length >= count) {
      // Havuz yeterli → Gemini çağrısı yapma
      this.logger.log(
        `[POOL HIT] topic="${topicName}" user=${userId} ` +
        `served ${poolQuestions.length} questions from pool.`,
      );
      await this.markAsSeen(userId, poolQuestions, cefrLevel);
      await this.incrementUsageCount(poolQuestions.map((q) => q.id));
      await this.triggerRefillIfLow(topicId, topicName, cefrLevel, language);
      return poolQuestions.map(this.toPooledQuestion('pool'));
    }

    // ── 2. Havuz yetersiz → Gemini fallback ──────────────────────────────
    const fromGemini = poolQuestions.length;
    const stillNeeded = count - fromGemini;

    this.logger.log(
      `[POOL MISS] topic="${topicName}" user=${userId} ` +
      `pool=${fromGemini}/${count}, calling Gemini for ${stillNeeded} more…`,
    );

    let geminiQuestions: PooledQuestion[] = [];
    try {
      const raw = await this.gemini.generateQuizQuestions({
        topic: topicName,
        cefrLevel,
        interests,
        count: stillNeeded,
        language,
      });

      geminiQuestions = raw.map((q) => ({
        id: '', // henüz kaydedilmedi; servis edildikten sonra id atanacak
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        hint: q.hint,
        grammar_point: q.grammar_point,
        source: 'gemini' as const,
      }));

      // Async: Gemini sorularını havuza kaydet (response'u bloklamaz)
      this.saveGeminiQuestionsToPool(topicId, cefrLevel, language, raw).catch((err) =>
        this.logger.warn(`Failed to persist Gemini questions: ${err?.message}`),
      );
    } catch (err: any) {
      this.logger.error(`Gemini fallback failed: ${err?.message}`);
    }

    // Havuzdan gelen soruları işaretle
    if (poolQuestions.length > 0) {
      await this.markAsSeen(userId, poolQuestions, cefrLevel);
      await this.incrementUsageCount(poolQuestions.map((q) => q.id));
    }

    // Refill tetikle
    await this.triggerRefillIfLow(topicId, topicName, cefrLevel, language);

    const result: PooledQuestion[] = [
      ...poolQuestions.map(this.toPooledQuestion('pool')),
      ...geminiQuestions,
    ];

    return result.slice(0, count);
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private async fetchFromPool(
    userId: string,
    topicId: string,
    cefrLevel: string,
    limit: number,
  ): Promise<QuizQuestionEntity[]> {
    /**
     * Kullanıcının son 30 günde gördüğü soru ID'lerini alt sorgu ile dışarıda bırak.
     * TypeORM QueryBuilder ile NOT IN subquery kullanılır.
     */
    const now = new Date();

    const seenSubQuery = this.seenRepo
      .createQueryBuilder('s')
      .select('s.questionId')
      .where('s.userId = :userId', { userId })
      .andWhere('s.expiresAt > :now', { now });

    return this.questionRepo
      .createQueryBuilder('q')
      .where('q.topicId = :topicId', { topicId })
      .andWhere('q.cefrLevel = :cefrLevel', { cefrLevel })
      .andWhere('q.poolReady = true')
      .andWhere(`q.id NOT IN (${seenSubQuery.getQuery()})`)
      .setParameters(seenSubQuery.getParameters())
      .orderBy('RANDOM()')
      .limit(limit)
      .getMany();
  }

  private async markAsSeen(
    userId: string,
    questions: QuizQuestionEntity[],
    cefrLevel: string,
  ): Promise<void> {
    if (questions.length === 0) return;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SEEN_EXPIRY_DAYS);

    // UPSERT: Var olan kaydı güncelle (expiresAt yenile), yoksa ekle
    await this.seenRepo
      .createQueryBuilder()
      .insert()
      .into(UserSeenQuestionEntity)
      .values(
        questions.map((q) => ({
          userId,
          questionId: q.id,
          answeredCorrectly: null,
          seenAtLevel: cefrLevel,
          expiresAt,
        })),
      )
      .orUpdate(['expires_at', 'seen_at_level'], ['userId', 'questionId'])
      .execute();
  }

  /**
   * Kullanıcının cevap verdiği soruların `answeredCorrectly` alanını günceller.
   * Quiz submit akışından çağrılır.
   */
  async updateAnswerResult(
    userId: string,
    questionId: string,
    correct: boolean,
  ): Promise<void> {
    await this.seenRepo.update(
      { userId, questionId },
      { answeredCorrectly: correct },
    );
  }

  private async incrementUsageCount(questionIds: string[]): Promise<void> {
    if (questionIds.length === 0) return;
    await this.questionRepo
      .createQueryBuilder()
      .update(QuizQuestionEntity)
      .set({ usageCount: () => 'usage_count + 1' })
      .whereInIds(questionIds)
      .execute();
  }

  private async saveGeminiQuestionsToPool(
    topicId: string,
    cefrLevel: string,
    language: 'en' | 'tr',
    questions: Awaited<ReturnType<typeof this.gemini.generateQuizQuestions>>,
  ): Promise<void> {
    const entities = questions.map((q) => {
      const correctText = q.options[q.correctIndex] ?? q.options[0];
      return this.questionRepo.create({
        topicId,
        cefrLevel,
        language,
        type: QuestionType.MULTIPLE_CHOICE,
        questionText: q.question,
        options: q.options,
        correctAnswer: correctText,
        correctIndex: q.correctIndex,
        explanationEn: language === 'en' ? q.explanation : undefined,
        explanationTr: language === 'tr' ? q.explanation : undefined,
        hint: q.hint,
        grammarPoint: q.grammar_point,
        isAiGenerated: true,
        poolReady: true,
        usageCount: 0,
      });
    });

    await this.questionRepo.save(entities);
    this.logger.log(`Async-saved ${entities.length} Gemini questions to pool for topic=${topicId}.`);
  }

  private async triggerRefillIfLow(
    topicId: string,
    topicName: string,
    cefrLevel: string,
    language: 'en' | 'tr',
  ): Promise<void> {
    const remaining = await this.questionRepo.count({
      where: { topicId, cefrLevel, poolReady: true },
    });

    if (remaining < REFILL_TRIGGER_THRESHOLD) {
      await this.scheduler.triggerRefillForTopic(topicId, topicName, cefrLevel, language);
    }
  }

  private toPooledQuestion(source: 'pool' | 'gemini') {
    return (q: QuizQuestionEntity): PooledQuestion => ({
      id: q.id,
      question: q.questionText,
      options: q.options,
      correctIndex: q.correctIndex ?? 0,
      explanation: q.language === 'tr' ? (q.explanationTr ?? '') : (q.explanationEn ?? ''),
      hint: q.hint ?? '',
      grammar_point: q.grammarPoint ?? '',
      source,
    });
  }
}
