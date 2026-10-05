import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { ObservabilityService } from '../../infrastructure/observability/observability.service';
import { TopicEntity } from '../../domain/entities/topic.entity';
import { QuestionPoolStore } from './question-pool.store';
import { QUESTION_POOL_QUEUE, type FillTopicPoolJobData } from './question-pool.producer';

/** concurrency 1 keeps Gemini calls sequential (rate limits). */
@Processor(QUESTION_POOL_QUEUE, { concurrency: 1 })
export class QuestionPoolConsumer extends WorkerHost {
  private readonly logger = new Logger(QuestionPoolConsumer.name);

  constructor(
    private readonly store: QuestionPoolStore,
    @InjectRepository(TopicEntity)
    private readonly topicRepo: Repository<TopicEntity>,
    private readonly obs: ObservabilityService,
  ) {
    super();
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.obs.recordQueueJob('question-pool', job, 'ok');
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, err: Error): void {
    if (job) this.obs.recordQueueJob('question-pool', job, 'failed', err);
  }

  async process(job: Job<FillTopicPoolJobData>): Promise<void> {
    const { topicId, reason, targetTotal } = job.data;
    const topic = await this.topicRepo.findOne({ where: { id: topicId, isActive: true } });
    if (!topic) {
      this.logger.warn(`Topic ${topicId} not found or inactive, skipping ${reason} job.`);
      return;
    }
    const amount = targetTotal
      ? targetTotal - (await this.store.countReady(topicId))
      : job.data.amount;
    if (amount <= 0) return;
    await this.store.generateForTopic(topic, amount);
  }
}
