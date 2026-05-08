import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeminiService } from '../../../infrastructure/gemini/gemini.service';
import { TopicEntity } from '../../../domain/entities/topic.entity';
import { UserEntity } from '../../../domain/entities/user.entity';
import { QuizPoolService } from '../../question-pool/quiz-pool.service';

export interface GenerateQuizDto {
  topicId: string;
  topicName?: string; // fallback name if topicId not in DB
  questionCount?: number;
  cefrLevel?: string; // override user's stored level
}

@Injectable()
export class GenerateQuizUseCase {
  private readonly logger = new Logger(GenerateQuizUseCase.name);

  constructor(
    private readonly gemini: GeminiService,
    private readonly pool: QuizPoolService,
    @InjectRepository(TopicEntity)
    private readonly topicRepo: Repository<TopicEntity>,
  ) {}

  async execute(dto: GenerateQuizDto, user: UserEntity) {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidUuid = UUID_REGEX.test(dto.topicId);
    const topic = isValidUuid
      ? await this.topicRepo.findOne({ where: { id: dto.topicId } })
      : null;

    const topicName = topic?.name ?? dto.topicName ?? dto.topicId;
    const cefrLevel = dto.cefrLevel ?? user.cefrLevel ?? 'B1';
    const count = dto.questionCount ?? 10;
    const language = (user.language ?? 'tr') as 'en' | 'tr';

    // ── Havuzdan önce dene ─────────────────────────────────────────────
    if (isValidUuid) {
      try {
        const pooled = await this.pool.serve({
          userId: user.id,
          topicId: dto.topicId,
          topicName,
          cefrLevel,
          count,
          interests: user.interests ?? [],
          language,
        });

        if (pooled.length > 0) {
          this.logger.log(
            `Quiz served from pool for user=${user.id} topic="${topicName}" ` +
            `(${pooled.filter((q) => q.source === 'pool').length} pool, ` +
            `${pooled.filter((q) => q.source === 'gemini').length} gemini)`,
          );

          // Response formatını önceki API ile uyumlu tut
          return {
            topicId: topic?.id ?? dto.topicId,
            topicName,
            cefrLevel,
            questions: pooled.map((q) => ({
              question: q.question,
              options: q.options,
              correctIndex: q.correctIndex,
              explanation: q.explanation,
              hint: q.hint,
              grammar_point: q.grammar_point,
              // Geriye dönük uyumluluk: eski alanlar da doldurulur
              _poolQuestionId: q.id || undefined,
              _source: q.source,
            })),
            totalQuestions: pooled.length,
          };
        }
      } catch (err: any) {
        // Pool servisi hata verirse direkt Gemini'ye düş — kullanıcıyı engelleme
        this.logger.warn(
          `Pool serve failed for topic="${topicName}", falling back to Gemini. Error: ${err?.message}`,
        );
      }
    }

    // ── Gemini fallback (pool yoksa veya UUID geçersizse) ─────────────
    this.logger.log(`Calling Gemini for topic="${topicName}" (pool skipped or empty)`);
    const questions = await this.gemini.generateQuizQuestions({
      topic: topicName,
      cefrLevel,
      interests: user.interests ?? [],
      count,
      language,
    });

    return {
      topicId: topic?.id ?? dto.topicId,
      topicName,
      cefrLevel,
      questions,
      totalQuestions: questions.length,
    };
  }
}
