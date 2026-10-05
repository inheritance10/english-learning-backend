import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export const QUESTION_POOL_QUEUE = 'question-pool';

export type PoolFillReason = 'baseline' | 'demand' | 'on-demand';

export interface FillTopicPoolJobData {
  topicId: string;
  /** How many new questions to add. */
  amount: number;
  reason: PoolFillReason;
  /** If set, top up to this pool size instead (safe to retry after a partial run). */
  targetTotal?: number;
}

@Injectable()
export class QuestionPoolProducer {
  private readonly logger = new Logger(QuestionPoolProducer.name);

  constructor(
    @InjectQueue(QUESTION_POOL_QUEUE)
    private readonly queue: Queue<FillTopicPoolJobData>,
  ) {}

  /**
   * Fills a topic's pool in the background when a user's request found it short.
   * A fixed jobId stops repeated requests from queuing the same fill; removeOnComplete frees the slot after it runs.
   */
  async enqueueOnDemand(topicId: string, amount: number): Promise<void> {
    await this.queue.add(
      'fill-topic-pool',
      { topicId, amount, reason: 'on-demand' },
      {
        jobId: `pool-on-demand-${topicId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 8_000 },
        removeOnComplete: true,
        removeOnFail: { count: 50 },
      },
    );
  }

  /** jobId is per topic + reason + day, so a cron firing twice doesn't double the work. */
  async scheduleFillJobs(jobs: FillTopicPoolJobData[]): Promise<void> {
    if (jobs.length === 0) return;
    const today = new Date().toISOString().split('T')[0];

    await this.queue.addBulk(
      jobs.map((data) => ({
        name: 'fill-topic-pool' as const,
        data,
        opts: {
          jobId: `pool-${data.reason}-${data.topicId}-${today}`,
          attempts: 3,
          backoff: { type: 'exponential' as const, delay: 8_000 },
          removeOnComplete: { count: 200 },
          removeOnFail: { count: 50 },
        },
      })),
    );

    const total = jobs.reduce((sum, j) => sum + j.amount, 0);
    this.logger.log(`Queued ${jobs.length} pool jobs (${jobs[0].reason}) for ${total} questions.`);
  }
}
