import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export const QUESTION_POOL_QUEUE = 'question-pool';

export interface FillTopicPoolJobData {
  topicId: string;
  topicName: string;
  cefrLevel: string;
  /** Mevcut soru sayısı — consumer ne kadar üretmesi gerektiğini bilir. */
  currentCount: number;
  /** Hedef soru sayısı (MIN_POOL_SIZE). */
  targetCount: number;
  language: 'en' | 'tr';
}

@Injectable()
export class QuestionPoolProducer {
  private readonly logger = new Logger(QuestionPoolProducer.name);

  constructor(
    @InjectQueue(QUESTION_POOL_QUEUE)
    private readonly queue: Queue<FillTopicPoolJobData>,
  ) {}

  /**
   * Belirli bir topic için havuz doldurma job'u ekler.
   * jobId idempotent: aynı gün aynı topic için tekrar eklenmez.
   */
  async scheduleFillJob(data: FillTopicPoolJobData): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const jobId = `pool-fill-${data.topicId}-${today}`;

    await this.queue.add('fill-topic-pool', data, {
      jobId,                    // idempotent — aynı gün tekrar işlenmez
      attempts: 3,
      backoff: { type: 'exponential', delay: 8_000 },
      removeOnComplete: { count: 20 },
      removeOnFail: { count: 10 },
      // Her job arasına 2 saniye gecikme: Gemini quota koruması
      delay: 2_000,
    });

    this.logger.log(
      `Queued pool-fill job for topic="${data.topicName}" (${data.cefrLevel}) — ` +
      `current=${data.currentCount}, target=${data.targetCount}`,
    );
  }

  /**
   * Çoklu topic için toplu job ekleme.
   * addBulk, tek bir Redis roundtrip'te tüm job'ları ekler.
   */
  async scheduleFillJobs(jobs: FillTopicPoolJobData[]): Promise<void> {
    if (jobs.length === 0) return;

    const today = new Date().toISOString().split('T')[0];

    await this.queue.addBulk(
      jobs.map((data, i) => ({
        name: 'fill-topic-pool' as const,
        data,
        opts: {
          jobId: `pool-fill-${data.topicId}-${today}`,
          attempts: 3,
          backoff: { type: 'exponential' as const, delay: 8_000 },
          removeOnComplete: { count: 20 },
          removeOnFail: { count: 10 },
          delay: i * 2_000, // her job 2s arayla işlenir
        },
      })),
    );

    this.logger.log(`Queued ${jobs.length} pool-fill jobs.`);
  }
}
