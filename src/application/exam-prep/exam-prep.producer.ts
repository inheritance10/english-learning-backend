import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export const EXAM_PREP_QUEUE = 'exam-prep';

@Injectable()
export class ExamPrepProducer {
  private readonly logger = new Logger(ExamPrepProducer.name);

  constructor(
    @InjectQueue(EXAM_PREP_QUEUE)
    private readonly queue: Queue,
  ) {}

  async scheduleVariantPreGeneration(): Promise<void> {
    await this.queue.add(
      'pre-generate-variants',
      {},
      {
        delay: 0,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 10 },
        jobId: `pre-generate-variants-${new Date().toISOString().split('T')[0]}`,
      },
    );
    this.logger.log('Scheduled pre-generate-variants job');
  }
}
