import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuizQuestionEntity } from '../../domain/entities/quiz-question.entity';
import { UserSeenQuestionEntity } from '../../domain/entities/user-seen-question.entity';
import { TopicEntity } from '../../domain/entities/topic.entity';
import { QuestionPoolStore } from './question-pool.store';

/** A served question is hidden from that user for this many days. */
const SEEN_EXPIRY_DAYS = 30;

export interface PooledQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  hint: string;
  grammar_point: string;
  source: 'pool' | 'gemini';
}

/**
 * Serves quiz questions from the shared pool (questions the user hasn't seen in 30 days).
 * Only if the pool can't cover the request are new questions generated — and those are
 * saved to the pool too, so the next user gets them for free.
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
    private readonly store: QuestionPoolStore,
  ) {}

  async serve(params: {
    userId: string;
    topicId: string;
    cefrLevel: string;
    count: number;
    interests: string[];
    language: 'en' | 'tr';
  }): Promise<PooledQuestion[]> {
    const { userId, topicId, cefrLevel, count, interests, language } = params;

    const fromPool = await this.fetchUnseen(userId, topicId, count);
    let generated: QuizQuestionEntity[] = [];

    if (fromPool.length < count) {
      const topic = await this.topicRepo.findOne({ where: { id: topicId } });
      if (topic) {
        this.logger.log(`[POOL MISS] topic="${topic.name}" user=${userId} pool=${fromPool.length}/${count}`);
        try {
          generated = await this.store.generateForTopic(topic, count - fromPool.length, interests);
        } catch (err: any) {
          this.logger.error(`Live generation failed for topic="${topic.name}": ${err?.message}`);
        }
      }
    }

    const served = [...fromPool, ...generated].slice(0, count);
    await this.markAsSeen(userId, served, cefrLevel);
    await this.incrementUsageCount(fromPool.map((q) => q.id));

    return served.map((q) => this.toPooled(q, language, generated.includes(q) ? 'gemini' : 'pool'));
  }

  async updateAnswerResult(userId: string, questionId: string, correct: boolean): Promise<void> {
    await this.seenRepo.update({ userId, questionId }, { answeredCorrectly: correct });
  }

  private fetchUnseen(userId: string, topicId: string, limit: number): Promise<QuizQuestionEntity[]> {
    return this.questionRepo
      .createQueryBuilder('q')
      .where('q.topicId = :topicId', { topicId })
      .andWhere('q.poolReady = true')
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM user_seen_questions s
                      WHERE s.question_id = q.id AND s.user_id = :userId AND s.expires_at > now())`,
        { userId },
      )
      .orderBy('RANDOM()')
      .limit(limit)
      .getMany();
  }

  private async markAsSeen(userId: string, questions: QuizQuestionEntity[], cefrLevel: string): Promise<void> {
    if (questions.length === 0) return;
    const expiresAt = new Date(Date.now() + SEEN_EXPIRY_DAYS * 86_400_000);

    await this.seenRepo
      .createQueryBuilder()
      .insert()
      .into(UserSeenQuestionEntity)
      .values(questions.map((q) => ({ userId, questionId: q.id, answeredCorrectly: null, seenAtLevel: cefrLevel, expiresAt })))
      .orUpdate(['expires_at', 'seen_at_level'], ['user_id', 'question_id'])
      .execute();
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

  private toPooled(q: QuizQuestionEntity, language: 'en' | 'tr', source: 'pool' | 'gemini'): PooledQuestion {
    const explanation =
      language === 'tr' ? q.explanationTr || q.explanationEn : q.explanationEn || q.explanationTr;
    return {
      id: q.id,
      question: q.questionText,
      options: q.options,
      correctIndex: q.correctIndex ?? 0,
      explanation: explanation ?? '',
      hint: q.hint ?? '',
      grammar_point: q.grammarPoint ?? '',
      source,
    };
  }
}
