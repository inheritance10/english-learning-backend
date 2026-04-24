import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../domain/entities/user.entity';
import { WordBoosterProducer } from './word-booster.producer';

@Injectable()
export class WordNotificationScheduler {
  private readonly logger = new Logger(WordNotificationScheduler.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly producer: WordBoosterProducer,
  ) {}

  /**
   * Every day at 08:00 — schedule the day's word jobs for all enabled users.
   * BullMQ handles the delay-based delivery (10m / 30m / 60m intervals).
   *
   * Dev override: runs every 2 minutes so you can test without waiting.
   */
  @Cron(
    process.env.NODE_ENV === 'production'
      ? '0 8 * * *'       // 08:00 every day
      : '*/2 * * * *',    // every 2 min in dev
  )
  async scheduleDailyWordNotifications(): Promise<void> {
    this.logger.log('Word Booster daily scheduler triggered');
    await this.producer.scheduleAllUsers();
  }

  /**
   * Dev / admin: regenerate today's schedule for a single user immediately.
   * Called from the test-send endpoint.
   */
  async rescheduleUser(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new Error(`User ${userId} not found`);
    // force=true → bypass "already scheduled today" guard so test-send always works
    await this.producer.scheduleForUser(user, true);
  }
}
