import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WordEntity } from '../../domain/entities/word.entity';
import { UserSeenWordEntity } from '../../domain/entities/user-seen-word.entity';
import { FREQUENCY_OPTIONS, FrequencyKey } from '../../domain/constants/word-booster.constants';

export interface WordJobData {
  userId: string;
  wordId: string;
  word: string;
  meaning: string;
  exampleSentence: string | null;
  level: string;
  delayMs: number;
  jobIndex: number;
  totalJobs: number;
}

/** CEFR level order — used for fallback escalation */
const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

@Injectable()
export class WordQueueService {
  private readonly logger = new Logger(WordQueueService.name);

  constructor(
    @InjectRepository(WordEntity)
    private readonly wordRepo: Repository<WordEntity>,
    @InjectRepository(UserSeenWordEntity)
    private readonly seenRepo: Repository<UserSeenWordEntity>,
  ) {}

  /**
   * Pick `count` unseen words for a user at their CEFR level.
   * Falls back to higher levels if current level is exhausted.
   * If ALL levels are exhausted, resets the oldest seen words and tries again.
   */
  async pickUnseenWords(
    userId: string,
    level: string,
    count: number,
  ): Promise<WordEntity[]> {
    const words = await this.fetchUnseenFromLevel(userId, level, count);

    if (words.length === count) return words;

    // --- Fallback: try higher CEFR levels ---
    const startIdx = CEFR_ORDER.indexOf(level);
    const fallbackLevels = CEFR_ORDER.slice(startIdx + 1);

    let collected = [...words];

    for (const fallbackLevel of fallbackLevels) {
      if (collected.length >= count) break;
      const needed = count - collected.length;
      const extra = await this.fetchUnseenFromLevel(userId, fallbackLevel, needed);
      collected = [...collected, ...extra];
      if (extra.length > 0) {
        this.logger.log(
          `User ${userId}: fell back to level ${fallbackLevel}, got ${extra.length} words`,
        );
      }
    }

    // --- Final fallback: reset oldest seen words and retry ---
    if (collected.length < count) {
      this.logger.warn(
        `User ${userId}: all levels exhausted — resetting oldest 30-day seen words`,
      );
      await this.resetOldestSeenWords(userId, 90);
      const retry = await this.fetchUnseenFromLevel(userId, level, count - collected.length);
      collected = [...collected, ...retry];
    }

    return collected;
  }

  /**
   * Fetch unseen words at a specific level using LEFT JOIN IS NULL pattern.
   * Performant even with large datasets.
   */
  private async fetchUnseenFromLevel(
    userId: string,
    level: string,
    count: number,
  ): Promise<WordEntity[]> {
    return this.wordRepo
      .createQueryBuilder('w')
      .leftJoin(
        'user_seen_words',
        'usw',
        'usw.word_id = w.id AND usw.user_id = :userId',
        { userId },
      )
      .where('w.level = :level', { level })
      .andWhere('usw.word_id IS NULL')   // never seen by this user
      .orderBy('RANDOM()')
      .limit(count)
      .getMany();
  }

  /**
   * Mark a word as seen after successful delivery.
   * Uses INSERT ... ON CONFLICT DO NOTHING to handle race conditions safely.
   */
  async markAsSeen(userId: string, wordId: string, level: string): Promise<void> {
    await this.seenRepo
      .createQueryBuilder()
      .insert()
      .into(UserSeenWordEntity)
      .values({ userId, wordId, seenAtLevel: level })
      .orIgnore()   // skip if (userId, wordId) already exists
      .execute();
  }

  /**
   * Build BullMQ job payloads for a user's daily word plan.
   * Each job has a delay so they fire at the right intervals.
   *
   * Example: 5 words, frequency=30m
   *   Job 0: delay=0ms      → fires immediately (at 08:00 if cron runs at 08:00)
   *   Job 1: delay=1800000ms → fires 30 min later
   *   Job 2: delay=3600000ms → fires 60 min later
   *   ...
   */
  async buildDailyJobPayloads(
    userId: string,
    level: string,
    count: number,
    frequencyKey: string,
  ): Promise<WordJobData[]> {
    const frequencyMinutes = FREQUENCY_OPTIONS[frequencyKey as FrequencyKey] ?? 60;
    const frequencyMs = frequencyMinutes * 60 * 1000;

    const words = await this.pickUnseenWords(userId, level, count);

    if (words.length === 0) {
      this.logger.warn(`User ${userId}: no words available even after fallback`);
      return [];
    }

    return words.map((word, index) => ({
      userId,
      wordId: word.id,
      word: word.word,
      meaning: word.meaning,
      exampleSentence: word.exampleSentence ?? null,
      level: word.level,
      delayMs: index * frequencyMs,
      jobIndex: index + 1,
      totalJobs: words.length,
    }));
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Delete the oldest seen-word records for a user (>= daysOld).
   * Used as a full-cycle reset when all words have been seen.
   */
  private async resetOldestSeenWords(userId: string, daysOld: number): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    await this.seenRepo
      .createQueryBuilder()
      .delete()
      .from(UserSeenWordEntity)
      .where('userId = :userId', { userId })
      .andWhere('seenAt < :cutoff', { cutoff })
      .execute();
  }
}
