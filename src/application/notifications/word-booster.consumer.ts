import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ObservabilityService } from '../../infrastructure/observability/observability.service';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity } from '../../domain/entities/notification.entity';
import { UserEntity } from '../../domain/entities/user.entity';
import { UserSeenWordEntity } from '../../domain/entities/user-seen-word.entity';
import { WordTranslationEntity } from '../../domain/entities/word-translation.entity';
import { FcmNotificationService, InvalidFcmTokenError } from '../../infrastructure/notifications/fcm-notification.service';
import { WordQueueService, WordJobData } from './word-queue.service';
import { WORD_BOOSTER_QUEUE } from './word-booster.producer';

@Processor(WORD_BOOSTER_QUEUE, {
  concurrency: 5,   // process up to 5 jobs in parallel
})
export class WordBoosterConsumer extends WorkerHost {
  private readonly logger = new Logger(WordBoosterConsumer.name);
  private readonly isDev = process.env.NODE_ENV !== 'production';

  constructor(
    private readonly fcmService: FcmNotificationService,
    private readonly wordQueueService: WordQueueService,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(UserSeenWordEntity)
    private readonly seenRepo: Repository<UserSeenWordEntity>,
    @InjectRepository(WordTranslationEntity)
    private readonly translationRepo: Repository<WordTranslationEntity>,
    private readonly obs: ObservabilityService,
  ) {
    super();
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.obs.recordQueueJob('word-booster', job, 'ok');
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, err: Error): void {
    if (job) this.obs.recordQueueJob('word-booster', job, 'failed', err);
  }

  async process(job: Job<WordJobData>): Promise<void> {
    const { userId, wordId, word, level } = job.data;

    this.logger.debug(
      `Processing job ${job.id}: "${word}" → user ${userId} (${level})`,
    );

    // 1. Load user to get FCM token, language and notification level
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'fcmToken', 'isWordNotificationEnabled', 'notificationLevel', 'cefrLevel', 'language'],
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

    // 2. Fetch translation: try user's UI language → 'tr' (native) → 'en'
    const userLanguage = user.language ?? 'tr';
    let translation = await this.translationRepo.findOne({
      where: { wordId, language: userLanguage },
    });

    if (!translation && userLanguage !== 'tr') {
      translation = await this.translationRepo.findOne({
        where: { wordId, language: 'tr' },
      });
    }

    if (!translation) {
      translation = await this.translationRepo.findOne({
        where: { wordId, language: 'en' },
      });
    }

    const meaning = translation?.meaning ?? word;
    const exampleSentence = translation?.exampleSentence ?? null;

    // 3. Build notification content
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

    // 4. Send FCM push notification directly to user's device token
    try {
      await this.fcmService.sendToDevice(user.fcmToken, title, body, data);
    } catch (err: any) {
      if (err instanceof InvalidFcmTokenError) {
        // Token artık geçersiz: temizle, yeni token uygulama açılışında gelir. Yeniden denemenin anlamı yok.
        this.logger.warn(`User ${userId} FCM token is dead — clearing it`);
        await this.userRepo.update(userId, { fcmToken: null as any });
        // Admin panelinde (Arka plan sekmesi) görünsün diye kayıt düşüyoruz
        this.obs.recordJob({
          name: 'fcm:token-cleared',
          kind: 'queue',
          status: 'ok',
          startedAt: new Date(),
          durationMs: 0,
          meta: { userId, reason: 'invalid_token', word, jobId: job.id },
        });
        return;
      }
      this.logger.error(`FCM send failed for word "${word}": ${err.message}`);
      throw err;   // re-throw so BullMQ retries the job
    }

    // 5. Save to notification DB (user's in-app inbox)
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

    // 6. Mark word as seen — ONLY after successful delivery
    await this.wordQueueService.markAsSeen(userId, wordId, level);

    this.logger.log(
      `✅ Sent "${word}" (${userLanguage}) to user ${userId} [job ${job.data.jobIndex}/${job.data.totalJobs}]`,
    );

    // 7. [DEV ONLY] Auto-reset after last job so the cycle repeats immediately
    if (this.isDev && job.data.jobIndex === job.data.totalJobs) {
      this.logger.warn(
        `[DEV] Last word delivered for user ${userId} — resetting seen words & schedule date for next cycle`,
      );
      await this.seenRepo.delete({ userId });
      await this.userRepo.update(userId, { wordBoosterScheduledDate: null });
    }
  }
}
