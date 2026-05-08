import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TopicEntity } from '../../domain/entities/topic.entity';
import { QuizQuestionEntity } from '../../domain/entities/quiz-question.entity';
import { QuestionPoolProducer, type FillTopicPoolJobData } from './question-pool.producer';

/**
 * Havuzdaki topic başına minimum soru sayısı.
 * Dev ortamında 5 → token tasarrufu; production'da 40.
 */
export const MIN_POOL_SIZE = process.env.NODE_ENV === 'production' ? 40 : 5;

/**
 * Bi-weekly soru havuzu doldurma scheduler'ı.
 *
 * Production : Her ayın 1. ve 15. günü 03:00 (Istanbul)
 * Development: Her 10 dakikada bir (test kolaylığı için)
 *
 * Akış:
 * 1. Tüm aktif topic'leri çek
 * 2. Her topic için mevcut poolReady soru sayısını say
 * 3. MIN_POOL_SIZE altındakileri BullMQ'ya job olarak ekle
 * 4. Producer idempotent jobId kullanır — cron tekrar atarsa duplicate olmaz
 */
@Injectable()
export class QuestionPoolScheduler {
  private readonly logger = new Logger(QuestionPoolScheduler.name);

  constructor(
    private readonly producer: QuestionPoolProducer,
    @InjectRepository(TopicEntity)
    private readonly topicRepo: Repository<TopicEntity>,
    @InjectRepository(QuizQuestionEntity)
    private readonly questionRepo: Repository<QuizQuestionEntity>,
  ) {}

  @Cron(
    process.env.NODE_ENV === 'production'
      ? '0 3 1,15 * *'   // 1. ve 15. gün saat 03:00
      : '*/10 * * * *',  // dev: her 10 dakika
    { timeZone: 'Europe/Istanbul' },
  )
  async refillPool(): Promise<void> {
    this.logger.log('🔄 Question pool refill started…');

    const topics = await this.topicRepo.find({ where: { isActive: true } });
    if (topics.length === 0) {
      this.logger.warn('No active topics found, skipping pool refill.');
      return;
    }

    // Her topic için mevcut pool sayısını tek sorguda al
    const counts: { topicid: string; count: string }[] = await this.questionRepo
      .createQueryBuilder('q')
      .select('q.topicId', 'topicid')
      .addSelect('COUNT(q.id)', 'count')
      .where('q.poolReady = true')
      .groupBy('q.topicId')
      .getRawMany();

    const countMap = new Map<string, number>(
      counts.map((r) => [r.topicid, parseInt(r.count, 10)]),
    );

    const jobsToQueue: FillTopicPoolJobData[] = [];

    for (const topic of topics) {
      const current = countMap.get(topic.id) ?? 0;
      if (current >= MIN_POOL_SIZE) continue; // dolu, atla

      jobsToQueue.push({
        topicId: topic.id,
        topicName: topic.name,
        cefrLevel: topic.cefrLevel ?? 'B1',
        currentCount: current,
        targetCount: MIN_POOL_SIZE,
        language: (topic.language ?? 'tr') as 'en' | 'tr',
      });
    }

    if (jobsToQueue.length === 0) {
      this.logger.log('✅ All topic pools are full, nothing to refill.');
      return;
    }

    await this.producer.scheduleFillJobs(jobsToQueue);
    this.logger.log(
      `📥 Queued ${jobsToQueue.length} / ${topics.length} topics for pool refill.`,
    );
  }

  /**
   * Belirli bir topic için anlık refill tetikler (havuz tükenince çağrılır).
   * Scheduler cron'unu beklemeden hemen job ekler.
   */
  async triggerRefillForTopic(topicId: string, topicName: string, cefrLevel: string, language: 'en' | 'tr'): Promise<void> {
    const current = await this.questionRepo.count({
      where: { topicId, poolReady: true },
    });

    if (current >= MIN_POOL_SIZE) return; // zaten dolu

    await this.producer.scheduleFillJob({
      topicId,
      topicName,
      cefrLevel,
      currentCount: current,
      targetCount: MIN_POOL_SIZE,
      language,
    });

    this.logger.log(
      `⚡ Triggered on-demand refill for topic="${topicName}" (current=${current})`,
    );
  }
}
