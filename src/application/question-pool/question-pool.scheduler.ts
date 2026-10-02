import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { QuestionPoolProducer, type FillTopicPoolJobData } from './question-pool.producer';

/** Every active topic is kept at least this full (10 questions per quiz → ~6 quizzes before a repeat). */
export const BASE_POOL_SIZE = 60;
/** New questions added per demand run, split across topics by recent usage. */
export const DEMAND_BUDGET = 500;
const DEMAND_WINDOW_DAYS = 14;
const MAX_DEMAND_PER_TOPIC = 60;

const isProd = process.env.NODE_ENV === 'production';

@Injectable()
export class QuestionPoolScheduler {
  private readonly logger = new Logger(QuestionPoolScheduler.name);

  constructor(
    private readonly producer: QuestionPoolProducer,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  /** Tops up topics below BASE_POOL_SIZE (new topics, or after a reset). */
  @Cron(isProd ? '0 3 * * *' : '*/10 * * * *', { timeZone: 'Europe/Istanbul' })
  async ensureBaseline(): Promise<number> {
    const rows: { id: string; ready: number }[] = await this.db.query(
      `SELECT t.id, COUNT(q.id) FILTER (WHERE q.pool_ready)::int AS ready
         FROM topics t LEFT JOIN quiz_questions q ON q."topicId" = t.id
        WHERE t."isActive"
        GROUP BY t.id
       HAVING COUNT(q.id) FILTER (WHERE q.pool_ready) < $1`,
      [BASE_POOL_SIZE],
    );
    if (rows.length === 0) return 0;

    await this.producer.scheduleFillJobs(
      rows.map((r) => ({
        topicId: r.id,
        amount: BASE_POOL_SIZE - r.ready,
        targetTotal: BASE_POOL_SIZE,
        reason: 'baseline',
      })),
    );
    return rows.reduce((sum, r) => sum + BASE_POOL_SIZE - r.ready, 0);
  }

  /**
   * 1st and 15th of each month: adds DEMAND_BUDGET questions, weighted by how many
   * questions each topic served in the last DEMAND_WINDOW_DAYS. Unused topics get nothing.
   */
  @Cron('0 4 1,15 * *', { timeZone: 'Europe/Istanbul' })
  async expandByDemand(): Promise<number> {
    const usage: { topicId: string; views: number }[] = await this.db.query(
      `SELECT q."topicId" AS "topicId", COUNT(*)::int AS views
         FROM user_seen_questions s
         JOIN quiz_questions q ON q.id = s.question_id
         JOIN topics t ON t.id = q."topicId" AND t."isActive"
        WHERE s.seen_at >= now() - ($1::int * interval '1 day')
        GROUP BY q."topicId"`,
      [DEMAND_WINDOW_DAYS],
    );

    const jobs = this.allocate(usage, DEMAND_BUDGET);
    if (jobs.length === 0) {
      this.logger.log('No quiz usage in the last 14 days — skipping demand expansion.');
      return 0;
    }
    await this.producer.scheduleFillJobs(jobs);
    return jobs.reduce((sum, j) => sum + j.amount, 0);
  }

  /** Proportional split with per-topic cap; leftover from capped topics is redistributed. */
  private allocate(usage: { topicId: string; views: number }[], budget: number): FillTopicPoolJobData[] {
    const amounts = new Map<string, number>();
    let open = usage.filter((u) => u.views > 0);
    let remaining = budget;

    while (remaining > 0 && open.length > 0) {
      const totalViews = open.reduce((sum, u) => sum + u.views, 0);
      let given = 0;
      for (const u of open) {
        const current = amounts.get(u.topicId) ?? 0;
        const share = Math.max(1, Math.round((remaining * u.views) / totalViews));
        const add = Math.min(share, MAX_DEMAND_PER_TOPIC - current, remaining - given);
        if (add > 0) {
          amounts.set(u.topicId, current + add);
          given += add;
        }
      }
      remaining -= given;
      open = open.filter((u) => (amounts.get(u.topicId) ?? 0) < MAX_DEMAND_PER_TOPIC);
      if (given === 0) break;
    }

    return [...amounts.entries()].map(([topicId, amount]) => ({ topicId, amount, reason: 'demand' as const }));
  }
}
