import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../infrastructure/redis/redis.module';
import { QuestionPoolProducer } from './question-pool.producer';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { QuizQuestionEntity } from '../../domain/entities/quiz-question.entity';
import { UserSeenQuestionEntity } from '../../domain/entities/user-seen-question.entity';
import { TopicEntity } from '../../domain/entities/topic.entity';
import { QuestionPoolStore } from './question-pool.store';

/** A served question is hidden from that user for this many days. */
const SEEN_EXPIRY_DAYS = 30;
/** If the pool can give at least this many, serve them now and refill in the background instead of making the user wait for Gemini. */
const MIN_SERVE_FROM_POOL = 5;
const seenKey = (userId: string) => `qseen:${userId}`;

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
    private readonly producer: QuestionPoolProducer,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
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
      if (fromPool.length >= MIN_SERVE_FROM_POOL) {
        // Enough to start: serve what we have, refill in the background (no Gemini wait for the user)
        this.producer
          .enqueueOnDemand(topicId, count - fromPool.length)
          .catch((err: any) => this.logger.warn(`On-demand fill enqueue failed: ${err?.message}`));
      } else {
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
    }

    const served = [...fromPool, ...generated].slice(0, count);
    await this.markAsSeen(userId, served, cefrLevel);
    await this.incrementUsageCount(fromPool.map((q) => q.id));

    return served.map((q) => this.toPooled(q, language, generated.includes(q) ? 'gemini' : 'pool'));
  }

  async updateAnswerResult(userId: string, questionId: string, correct: boolean): Promise<void> {
    await this.seenRepo.update({ userId, questionId }, { answeredCorrectly: correct });
  }

  /** Random ready questions the user hasn't seen recently. Ready list comes from the store cache. */
  private async fetchUnseen(userId: string, topicId: string, limit: number): Promise<QuizQuestionEntity[]> {
    const [ready, seenIds] = await Promise.all([this.store.readyPool(topicId), this.seenIds(userId)]);
    const candidates = ready.filter((q) => !seenIds.has(q.id));
    // Fisher-Yates shuffle on the candidates, then take what we need
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    return candidates.slice(0, limit);
  }

  /**
   * Question ids this user saw in the last 30 days. Redis sorted set (score = expiry ms);
   * on a cold cache it is rebuilt from the DB, which stays the source of truth.
   */
  private async seenIds(userId: string): Promise<Set<string>> {
    const key = seenKey(userId);
    try {
      if ((await this.redis.exists(key)) === 1) {
        await this.redis.zremrangebyscore(key, 0, Date.now());
        return new Set(await this.redis.zrange(key, 0, -1));
      }
    } catch (err: any) {
      this.logger.warn(`Seen cache read failed: ${err?.message}`);
    }

    const rows = await this.seenRepo.find({
      where: { userId, expiresAt: MoreThan(new Date()) },
      select: ['questionId', 'expiresAt'],
    });
    if (rows.length > 0) {
      const pipeline = this.redis.multi();
      for (const r of rows) pipeline.zadd(key, r.expiresAt.getTime(), r.questionId);
      pipeline.expire(key, (SEEN_EXPIRY_DAYS + 1) * 86_400);
      pipeline
        .exec()
        .catch((err: any) => this.logger.warn(`Seen cache rebuild failed: ${err?.message}`));
    }
    return new Set(rows.map((r) => r.questionId));
  }

  /** Keeps the seen cache in step with the DB. Only updates an existing cache; a missing one is rebuilt on next read. */
  private cacheSeen(userId: string, questions: QuizQuestionEntity[], expiresAt: Date): void {
    const key = seenKey(userId);
    this.redis
      .exists(key)
      .then(async (exists) => {
        if (exists !== 1) return;
        const pipeline = this.redis.multi();
        for (const q of questions) pipeline.zadd(key, expiresAt.getTime(), q.id);
        pipeline.expire(key, (SEEN_EXPIRY_DAYS + 1) * 86_400);
        await pipeline.exec();
      })
      .catch((err: any) => this.logger.warn(`Seen cache update failed: ${err?.message}`));
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
    this.cacheSeen(userId, questions, expiresAt);
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
