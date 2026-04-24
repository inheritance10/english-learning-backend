import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../domain/entities/user.entity';
import { WordQueueService } from './word-queue.service';

export const WORD_BOOSTER_QUEUE = 'word-booster';

@Injectable()
export class WordBoosterProducer {
  private readonly logger = new Logger(WordBoosterProducer.name);

  constructor(
    @InjectQueue(WORD_BOOSTER_QUEUE)
    private readonly queue: Queue,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly wordQueueService: WordQueueService,
  ) {}

  /**
   * Schedule daily word notification jobs for ALL enabled users.
   * Called by the scheduler cron at 08:00 every day.
   */
  async scheduleAllUsers(): Promise<void> {
    const users = await this.userRepo.find({
      where: { isWordNotificationEnabled: true },
    });

    this.logger.log(`Scheduling Word Booster jobs for ${users.length} users`);

    for (const user of users) {
      await this.scheduleForUser(user);
    }
  }

  /**
   * Schedule daily word notification jobs for a single user.
   * Also callable manually (e.g. when user first enables Word Booster).
   *
   * @param force  Skip the "already scheduled today" guard (used by test-send endpoint).
   */
  async scheduleForUser(user: UserEntity, force = false): Promise<void> {
    const level = user.notificationLevel || user.cefrLevel || 'A1';
    const count = user.wordNotificationCount || 5;
    const frequencyKey = user.wordNotificationFrequency || '60m';
    const today = this.getToday();

    // ── Guard: skip if already scheduled today (prevents duplicate batches from repeated cron fires)
    if (!force && user.wordBoosterScheduledDate === today) {
      this.logger.debug(`User ${user.id}: already scheduled for ${today}, skipping`);
      return;
    }

    try {
      // Remove any pending jobs left from a previous schedule for this user
      await this.removePendingJobsForUser(user.id);

      // Build payloads — each has a delay so they fire at the right time
      const payloads = await this.wordQueueService.buildDailyJobPayloads(
        user.id,
        level,
        count,
        frequencyKey,
      );

      if (payloads.length === 0) {
        this.logger.warn(`User ${user.id}: no word payloads generated, skipping`);
        return;
      }

      // Add all jobs to BullMQ in bulk
      await this.queue.addBulk(
        payloads.map((payload) => ({
          name: 'send-word',
          data: payload,
          opts: {
            delay: payload.delayMs,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 50 },
            jobId: `wb_${user.id}_${payload.wordId}_${this.getToday()}`,
          },
        })),
      );

      // Mark user as scheduled for today so cron doesn't add duplicate batches
      await this.userRepo.update(user.id, { wordBoosterScheduledDate: today });

      this.logger.log(
        `User ${user.id} (${level}): scheduled ${payloads.length} jobs ` +
        `[count=${count}, freq=${frequencyKey}]`,
      );
    } catch (err: any) {
      this.logger.error(`Failed to schedule for user ${user.id}: ${err.message}`);
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async removePendingJobsForUser(userId: string): Promise<void> {
    const today = this.getToday();
    const prefix = `wb_${userId}_`;

    try {
      const delayed = await this.queue.getDelayed();
      const waiting = await this.queue.getWaiting();
      const toRemove = [...delayed, ...waiting].filter(
        (job) => job.id?.startsWith(prefix) && job.id?.endsWith(`_${today}`),
      );
      await Promise.all(toRemove.map((job) => job.remove()));

      if (toRemove.length > 0) {
        this.logger.debug(`Removed ${toRemove.length} pending jobs for user ${userId}`);
      }
    } catch {
      // non-critical — if removal fails, jobId deduplication handles it
    }
  }

  private getToday(): string {
    return new Date().toISOString().split('T')[0];
  }
}
