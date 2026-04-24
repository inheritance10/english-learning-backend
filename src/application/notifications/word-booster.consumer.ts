import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity } from '../../domain/entities/notification.entity';
import { UserEntity } from '../../domain/entities/user.entity';
import { FcmNotificationService } from '../../infrastructure/notifications/fcm-notification.service';
import { WordQueueService, WordJobData } from './word-queue.service';
import { WORD_BOOSTER_QUEUE } from './word-booster.producer';

@Processor(WORD_BOOSTER_QUEUE, {
  concurrency: 5,   // process up to 5 jobs in parallel
})
export class WordBoosterConsumer extends WorkerHost {
  private readonly logger = new Logger(WordBoosterConsumer.name);

  constructor(
    private readonly fcmService: FcmNotificationService,
    private readonly wordQueueService: WordQueueService,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {
    super();
  }

  async process(job: Job<WordJobData>): Promise<void> {
    const { userId, wordId, word, meaning, exampleSentence, level } = job.data;

    this.logger.debug(
      `Processing job ${job.id}: "${word}" → user ${userId} (${level})`,
    );

    // 1. Load user to get FCM token and notification level
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'fcmToken', 'isWordNotificationEnabled', 'notificationLevel', 'cefrLevel'],
    });

    if (!user) {
      this.logger.warn(`User ${userId} not found — skipping job`);
      return;
    }

    if (!user.isWordNotificationEnabled) {
      this.logger.debug(`User ${userId} disabled Word Booster — skipping job`);
      return;
    }

    if (!user.fcmToken) {
      this.logger.warn(`User ${userId} has no FCM token — skipping job`);
      return;
    }

    // 2. Build notification content
    const notifLevel = user.notificationLevel || user.cefrLevel || level;
    const title = `📚 Word Booster · ${notifLevel}`;
    const body = exampleSentence
      ? `${word}: ${meaning} — "${exampleSentence}"`
      : `${word}: ${meaning}`;

    const data: Record<string, string> = {
      wordId,
      word,
      meaning,
      level,
      type: 'word_booster',
      ...(exampleSentence ? { exampleSentence } : {}),
    };

    // 3. Send FCM push notification directly to user's device token (not topic broadcast)
    try {
      await this.fcmService.sendToDevice(user.fcmToken, title, body, data);
    } catch (err: any) {
      this.logger.error(`FCM send failed for word "${word}": ${err.message}`);
      throw err;   // re-throw so BullMQ retries the job
    }

    // 4. Save to notification DB (user's in-app inbox)
    await this.notificationRepo
      .createQueryBuilder()
      .insert()
      .into(NotificationEntity)
      .values({
        userId,
        title,
        body,
        type: 'word_booster',
        data: data as Record<string, any>,
        isRead: false,
      })
      .execute();

    // 5. Mark word as seen — ONLY after successful delivery
    await this.wordQueueService.markAsSeen(userId, wordId, level);

    this.logger.log(
      `✅ Sent "${word}" to user ${userId} [job ${job.data.jobIndex}/${job.data.totalJobs}]`,
    );
  }
}
