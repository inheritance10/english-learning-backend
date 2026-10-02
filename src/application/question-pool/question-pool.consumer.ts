import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
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
  ) {
    super();
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
