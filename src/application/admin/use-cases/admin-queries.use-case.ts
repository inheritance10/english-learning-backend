import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { REDIS_CLIENT } from '../../../infrastructure/redis/redis.module';
import { QUESTION_POOL_QUEUE } from '../../question-pool/question-pool.producer';
import { WORD_BOOSTER_QUEUE } from '../../notifications/word-booster.producer';
import { EXAM_PREP_QUEUE } from '../../exam-prep/exam-prep.producer';
import { QuizQuestionEntity } from '../../../domain/entities/quiz-question.entity';
import { TopicEntity } from '../../../domain/entities/topic.entity';
import { BASE_POOL_SIZE } from '../../question-pool/question-pool.scheduler';

const QUEUES = [QUESTION_POOL_QUEUE, WORD_BOOSTER_QUEUE, EXAM_PREP_QUEUE];

/** Read-only queries behind the admin panel. Raw SQL keeps the aggregates simple. */
@Injectable()
export class AdminQueriesUseCase {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectQueue(QUESTION_POOL_QUEUE) private readonly poolQueue: Queue,
    @InjectQueue(WORD_BOOSTER_QUEUE) private readonly wordQueue: Queue,
    @InjectQueue(EXAM_PREP_QUEUE) private readonly examQueue: Queue,
    private readonly config: ConfigService,
  ) {}

  async overview() {
    const [row] = await this.db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS "usersTotal",
        (SELECT COUNT(*)::int FROM daily_streaks WHERE "lastActiveDate" = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')) AS "activeToday",
        (SELECT COUNT(*)::int FROM subscriptions WHERE "isActive" AND "expiresAt" > now()) AS "activeSubscriptions",
        (SELECT COUNT(*)::int FROM users WHERE "rewardAccessUntil" > now()) AS "rewardProNow",
        (SELECT COUNT(*)::int FROM feedback WHERE created_at > now() - interval '7 days') AS "feedback7d",
        (SELECT COUNT(*)::int FROM ai_usage_logs WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')) AS "aiCallsToday",
        (SELECT COALESCE(SUM(input_tokens + output_tokens + thought_tokens), 0)::bigint FROM ai_usage_logs WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')) AS "aiTokensToday",
        (SELECT COUNT(*)::int FROM ai_usage_logs WHERE NOT ok AND created_at > now() - interval '24 hours') AS "aiErrors24h",
        (SELECT COUNT(*)::int FROM job_runs WHERE status = 'failed' AND started_at > now() - interval '24 hours') AS "jobFailures24h"
    `);
    return row;
  }

  async aiUsage(days: number) {
    const window = `created_at >= now() - ($1::int * interval '1 day')`;
    const cols = `COUNT(*)::int AS calls,
                  COALESCE(SUM(input_tokens), 0)::bigint AS "inputTokens",
                  COALESCE(SUM(output_tokens), 0)::bigint AS "outputTokens",
                  COALESCE(SUM(thought_tokens), 0)::bigint AS "thoughtTokens",
                  COUNT(*) FILTER (WHERE NOT ok)::int AS errors,
                  COALESCE(ROUND(AVG(duration_ms)), 0)::int AS "avgMs"`;
    const [daily, byFeature, byModel, recentErrors] = await Promise.all([
      this.db.query(`SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, ${cols}
                       FROM ai_usage_logs WHERE ${window} GROUP BY 1 ORDER BY 1`, [days]),
      this.db.query(`SELECT feature, ${cols} FROM ai_usage_logs WHERE ${window} GROUP BY 1 ORDER BY calls DESC`, [days]),
      this.db.query(`SELECT model, ${cols} FROM ai_usage_logs WHERE ${window} GROUP BY 1 ORDER BY calls DESC`, [days]),
      this.db.query(`SELECT feature, model, error, duration_ms AS "durationMs", created_at AS "createdAt"
                       FROM ai_usage_logs WHERE NOT ok AND ${window} ORDER BY created_at DESC LIMIT 30`, [days]),
    ]);
    return { days, daily, byFeature, byModel, recentErrors, pricing: this.pricing() };
  }

  /** Optional estimate: set GEMINI_PRICE_INPUT_PER_M / GEMINI_PRICE_OUTPUT_PER_M (USD per 1M tokens). */
  private pricing() {
    const input = Number(this.config.get('GEMINI_PRICE_INPUT_PER_M'));
    const output = Number(this.config.get('GEMINI_PRICE_OUTPUT_PER_M'));
    return input > 0 && output > 0 ? { inputPerM: input, outputPerM: output } : null;
  }

  async jobs(status: string | null, limit: number) {
    return this.db.query(
      `SELECT name, kind, status, started_at AS "startedAt", duration_ms AS "durationMs", error, meta
         FROM job_runs WHERE ($1::text IS NULL OR status = $1)
        ORDER BY started_at DESC LIMIT $2`,
      [status, limit],
    );
  }

  async jobSummary() {
    return this.db.query(`
      SELECT name, kind,
             COUNT(*)::int AS runs,
             COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
             COALESCE(ROUND(AVG(duration_ms)), 0)::int AS "avgMs",
             MAX(started_at) AS "lastRun"
        FROM job_runs WHERE started_at > now() - interval '24 hours'
       GROUP BY name, kind ORDER BY "lastRun" DESC`);
  }

  async feedback(type: string | null, limit: number) {
    return this.db.query(
      `SELECT f.type, f.message, f.contact_email AS "contactEmail", f.platform, f.app_version AS "appVersion",
              f.email_sent AS "emailSent", f.created_at AS "createdAt", u.name AS "userName"
         FROM feedback f LEFT JOIN users u ON u.id = f.user_id
        WHERE ($1::text IS NULL OR f.type = $1)
        ORDER BY f.created_at DESC LIMIT $2`,
      [type, limit],
    );
  }

  async subscriptions() {
    return this.db.query(`
      SELECT u.email, u.name, s.plan, s."expiresAt" AS "expiresAt", s."isActive" AS "isActive"
        FROM subscriptions s JOIN users u ON u.id = s."userId"
       WHERE s."isActive" AND s."expiresAt" > now()
       ORDER BY s."expiresAt" DESC LIMIT 200`);
  }

  async health() {
    const started = Date.now();
    const dbOk = await this.db.query('SELECT 1').then(() => true, () => false);
    const redisOk = await this.redis.ping().then(() => true, () => false);
    const queues = await Promise.all(
      [this.poolQueue, this.wordQueue, this.examQueue].map(async (q, i) => ({
        name: QUEUES[i],
        ...(await q.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed')),
      })),
    );
    return {
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      database: dbOk,
      redis: redisOk,
      gemini: { configured: !!this.config.get('GEMINI_API_KEY'), model: this.config.get('GEMINI_MODEL') },
      queues,
      environment: this.config.get('NODE_ENV') ?? 'development',
    };
  }

  /** API errors grouped by status and error code. */
  async errorGroups(hours: number) {
    return this.db.query(
      `SELECT status_code AS "statusCode", error_code AS "errorCode", COUNT(*)::int AS count,
              MAX(created_at) AS "lastSeen",
              (ARRAY_AGG(path ORDER BY created_at DESC))[1] AS "samplePath",
              (ARRAY_AGG(message ORDER BY created_at DESC))[1] AS "sampleMessage",
              (ARRAY_AGG(method ORDER BY created_at DESC))[1] AS method
         FROM api_errors WHERE created_at > now() - ($1::int * interval '1 hour')
        GROUP BY status_code, error_code ORDER BY count DESC LIMIT 100`,
      [hours],
    );
  }

  async recentApiErrors(limit: number) {
    return this.db.query(
      `SELECT method, path, status_code AS "statusCode", error_code AS "errorCode", message,
              user_id AS "userId", created_at AS "createdAt"
         FROM api_errors ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
  }

  /** Gemini failures grouped by HTTP status embedded in the error text (e.g. 402, 429, 503). */
  async geminiErrorGroups(hours: number) {
    return this.db.query(
      `SELECT feature, COALESCE(substring(error from '\\[(\\d{3})'), 'other') AS "httpStatus",
              COUNT(*)::int AS count, MAX(created_at) AS "lastSeen",
              (ARRAY_AGG(error ORDER BY created_at DESC))[1] AS "sampleError"
         FROM ai_usage_logs WHERE NOT ok AND created_at > now() - ($1::int * interval '1 hour')
        GROUP BY 1, 2 ORDER BY count DESC`,
      [hours],
    );
  }

  /** Question pool per topic: how many questions are ready vs. the target pool size. */
  async questionPool() {
    const rows = await this.db
      .getRepository(QuizQuestionEntity)
      .createQueryBuilder('q')
      .innerJoin(TopicEntity, 't', 't.id = q.topicId')
      .select('t.id', 'topicId')
      .addSelect('t.name', 'topic')
      .addSelect('t.isActive', 'isActive')
      .addSelect('COUNT(q.id)', 'total')
      .addSelect('COUNT(q.id) FILTER (WHERE q.poolReady = true)', 'ready')
      .addSelect('COUNT(q.id) FILTER (WHERE q.isAiGenerated = true)', 'aiGenerated')
      .addSelect('COALESCE(SUM(q.usageCount), 0)', 'used')
      .addSelect('MAX(q.createdAt)', 'lastCreatedAt')
      .groupBy('t.id')
      .addGroupBy('t.name')
      .addGroupBy('t.isActive')
      .orderBy('ready', 'ASC')
      .getRawMany<{ topicId: string; topic: string; isActive: boolean; total: string; ready: string; aiGenerated: string; used: string; lastCreatedAt: Date | null }>();

    const topics = rows.map((r) => ({
      topicId: r.topicId,
      topic: r.topic,
      isActive: r.isActive,
      total: Number(r.total),
      ready: Number(r.ready),
      target: BASE_POOL_SIZE,
      aiGenerated: Number(r.aiGenerated),
      used: Number(r.used),
      lastCreatedAt: r.lastCreatedAt,
    }));

    return {
      targetPerTopic: BASE_POOL_SIZE,
      totalReady: topics.reduce((n, t) => n + t.ready, 0),
      lowTopics: topics.filter((t) => t.isActive && t.ready < BASE_POOL_SIZE).length,
      topics,
    };
  }

  /** Failed jobs still held by BullMQ (with the reason BullMQ stored). */
  async queueFailed(queueName: string, limit: number) {
    const queue = this.queueByName(queueName);
    if (!queue) return [];
    const jobs = await queue.getFailed(0, limit - 1);
    return jobs.map((j) => ({
      id: j.id,
      name: j.name,
      reason: j.failedReason ?? 'unknown',
      attempts: j.attemptsMade,
      data: j.data,
      failedAt: j.finishedOn ? new Date(j.finishedOn).toISOString() : null,
    }));
  }

  /** Puts every failed job of a queue back to waiting. Jobs still failing for the same reason fail again. */
  async retryFailed(queueName: string): Promise<{ retried: number }> {
    const queue = this.queueByName(queueName);
    if (!queue) return { retried: 0 };
    const before = await queue.getFailedCount();
    await queue.retryJobs({ state: 'failed' });
    return { retried: before };
  }

  private queueByName(name: string): Queue | null {
    return ({ [QUESTION_POOL_QUEUE]: this.poolQueue, [WORD_BOOSTER_QUEUE]: this.wordQueue, [EXAM_PREP_QUEUE]: this.examQueue } as Record<string, Queue>)[name] ?? null;
  }
}
