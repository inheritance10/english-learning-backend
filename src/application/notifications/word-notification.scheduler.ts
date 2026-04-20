import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { WordEntity } from '../../domain/entities/word.entity';
import { FcmNotificationService } from '../../infrastructure/notifications/fcm-notification.service';
import { REDIS_CLIENT } from '../../infrastructure/redis/redis.module';

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

@Injectable()
export class WordNotificationScheduler {
  private readonly logger = new Logger(WordNotificationScheduler.name);

  constructor(
    @InjectRepository(WordEntity)
    private readonly wordRepo: Repository<WordEntity>,
    private readonly fcmService: FcmNotificationService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** Runs at the top of every hour: 00:00, 01:00, 02:00 ... */
  @Cron(CronExpression.EVERY_HOUR)
  async sendHourlyWordNotifications(): Promise<void> {
    this.logger.log('Word Booster cron started');

    for (const level of CEFR_LEVELS) {
      await this.sendWordForLevel(level);
    }

    this.logger.log('Word Booster cron completed');
  }

  /** Exposed for testing / manual trigger */
  async sendWordForLevel(level: string): Promise<void> {
    try {
      // Check quiet-hours guard key in Redis (set by quietHours middleware if needed)
      const guardKey = `word_booster:quiet:${level}`;
      const isQuiet = await this.redis.get(guardKey).catch(() => null);
      if (isQuiet) {
        this.logger.debug(`Skipping ${level} — quiet hours active`);
        return;
      }

      // Pick a random word, avoiding the last sent word (stored in Redis)
      const lastKey = `word_booster:last_word:${level}`;
      const lastWordId = await this.redis.get(lastKey).catch(() => null);

      let query = this.wordRepo.createQueryBuilder('w')
        .where('w.level = :level', { level })
        .orderBy('RANDOM()');

      if (lastWordId) {
        query = query.andWhere('w.id != :lastId', { lastId: lastWordId });
      }

      const word = await query.getOne();
      if (!word) {
        this.logger.warn(`No words found for level ${level}`);
        return;
      }

      // Store last sent to avoid immediate repetition
      await this.redis.setex(lastKey, 3600 * 6, word.id).catch(() => null);

      const topic = `word_booster_${level.toLowerCase()}`;
      const title = `📚 Word Booster · ${level}`;
      const body = `${word.word}: ${word.meaning}${word.exampleSentence ? ` — "${word.exampleSentence}"` : ''}`;

      await this.fcmService.sendToTopic(topic, title, body, {
        wordId: word.id,
        word: word.word,
        meaning: word.meaning,
        level,
        type: 'word_booster',
      });

      this.logger.log(`Sent "${word.word}" to topic ${topic}`);
    } catch (err: any) {
      this.logger.error(`Failed to send word for level ${level}: ${err.message}`);
    }
  }
}
