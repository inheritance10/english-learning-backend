import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, IsNull, Or } from 'typeorm';
import { WordEntity } from '../../domain/entities/word.entity';
import { UserSeenWordEntity } from '../../domain/entities/user-seen-word.entity';
import { UserWordSrsEntity } from '../../domain/entities/user-word-srs.entity';
import { WordTranslationEntity } from '../../domain/entities/word-translation.entity';

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export interface WordCard {
  wordId: string;
  word: string;
  level: string;
  phonetic?: string;
  partOfSpeech?: string;
  meaning: string;
  exampleSentence?: string;
  isReview: boolean;           // true = SRS re-review, false = first encounter
  srsIntervalLevel: number;
}

@Injectable()
export class WordBoosterSessionService {
  private readonly logger = new Logger(WordBoosterSessionService.name);

  constructor(
    @InjectRepository(WordEntity)
    private readonly wordRepo: Repository<WordEntity>,
    @InjectRepository(UserSeenWordEntity)
    private readonly seenRepo: Repository<UserSeenWordEntity>,
    @InjectRepository(UserWordSrsEntity)
    private readonly srsRepo: Repository<UserWordSrsEntity>,
    @InjectRepository(WordTranslationEntity)
    private readonly translationRepo: Repository<WordTranslationEntity>,
  ) {}

  /**
   * Build the swipe deck for today's session.
   *
   * Priority order:
   *  1. SRS review words whose nextReviewAt <= now (and not mastered)
   *  2. Brand-new words (not in user_seen_words)
   *
   * Returns max `limit` cards.
   */
  async getTodayWords(
    userId: string,
    level: string,
    limit: number,
    language: string,
  ): Promise<WordCard[]> {
    const cards: WordCard[] = [];

    // ── 1. SRS review words due now ──────────────────────────────────────────
    const reviewRecords = await this.srsRepo
      .createQueryBuilder('srs')
      .innerJoinAndSelect('srs.word', 'w')
      .where('srs.userId = :userId', { userId })
      .andWhere('srs.status != :mastered', { mastered: 'mastered' })
      .andWhere(
        '(srs.next_review_at IS NULL OR srs.next_review_at <= :now)',
        { now: new Date() },
      )
      .orderBy('srs.next_review_at', 'ASC', 'NULLS FIRST')
      .limit(limit)
      .getMany();

    for (const rec of reviewRecords) {
      const card = await this.buildCard(rec.word, language, true, rec.intervalLevel);
      if (card) cards.push(card);
    }

    // ── 2. New words (not yet seen) if deck not full ────────────────────────
    if (cards.length < limit) {
      const needed = limit - cards.length;
      const seenIds = reviewRecords.map((r) => r.wordId);

      const newWords = await this.fetchNewWords(userId, level, needed, seenIds);
      for (const word of newWords) {
        const card = await this.buildCard(word, language, false, 0);
        if (card) cards.push(card);
      }
    }

    return cards;
  }

  private async fetchNewWords(
    userId: string,
    level: string,
    count: number,
    excludeIds: string[],
  ): Promise<WordEntity[]> {
    const collected: WordEntity[] = [];

    const fetchFromLevel = async (lvl: string, needed: number) => {
      const qb = this.wordRepo
        .createQueryBuilder('w')
        .leftJoin(
          'user_seen_words',
          'usw',
          'usw.word_id = w.id AND usw.user_id = :userId',
          { userId },
        )
        .where('w.level = :level', { level: lvl })
        .andWhere('usw.word_id IS NULL')
        .orderBy('RANDOM()')
        .limit(needed);

      if (excludeIds.length > 0) {
        qb.andWhere('w.id NOT IN (:...excludeIds)', { excludeIds });
      }

      return qb.getMany();
    };

    // Try requested level first
    const primary = await fetchFromLevel(level, count);
    collected.push(...primary);

    // Fallback to higher CEFR levels
    if (collected.length < count) {
      const startIdx = CEFR_ORDER.indexOf(level);
      for (const fallback of CEFR_ORDER.slice(startIdx + 1)) {
        if (collected.length >= count) break;
        const extras = await fetchFromLevel(fallback, count - collected.length);
        collected.push(...extras);
      }
    }

    return collected.slice(0, count);
  }

  private async buildCard(
    word: WordEntity,
    language: string,
    isReview: boolean,
    srsIntervalLevel: number,
  ): Promise<WordCard | null> {
    if (!word) return null;

    // Fetch localized translation
    let translation = await this.translationRepo.findOne({
      where: { wordId: word.id, language },
    });
    if (!translation && language !== 'en') {
      translation = await this.translationRepo.findOne({
        where: { wordId: word.id, language: 'en' },
      });
    }

    const meaning = translation?.meaning ?? word.meaning ?? '';
    const exampleSentence = translation?.exampleSentence ?? word.exampleSentence ?? undefined;

    return {
      wordId: word.id,
      word: word.word,
      level: word.level,
      meaning,
      exampleSentence,
      isReview,
      srsIntervalLevel,
    };
  }
}
