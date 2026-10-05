import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsIn, IsOptional } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../../presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../presentation/decorators/current-user.decorator';
import { UserEntity } from '../../domain/entities/user.entity';
import { UserWordSrsEntity } from '../../domain/entities/user-word-srs.entity';
import { StoryEntity } from '../../domain/entities/story.entity';
import { WordEntity } from '../../domain/entities/word.entity';
import { VocabularyItemEntity, VocabularyStatus } from '../../domain/entities/vocabulary-item.entity';
import { WordTranslationEntity } from '../../domain/entities/word-translation.entity';
import { SrsService } from './srs.service';
import { WordBoosterSessionService } from './word-booster-session.service';
import { GeminiService } from '../../infrastructure/gemini/gemini.service';
import { WORD_BOOSTER_QUEUE } from '../notifications/word-booster.producer';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../infrastructure/redis/redis.module';

/** Story üretim kuralları: yeniden üretim için en az N yeni kelime, günde en fazla X üretim. */
const STORY_RULES = {
  freeThreshold: 3,
  subscriberThreshold: 1,
  dailyCap: 1,
};

class SwipeDto {
  @IsString()
  wordId: string;

  @IsIn(['left', 'right'])
  direction: 'left' | 'right';
}

class UpdateProfessionDto {
  @IsOptional()
  @IsString()
  profession: string;
}

@ApiTags('word-booster')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('word-booster')
export class WordBoosterController {
  private readonly logger = new Logger(WordBoosterController.name);

  constructor(
    private readonly sessionService: WordBoosterSessionService,
    private readonly srsService: SrsService,
    private readonly geminiService: GeminiService,
    @InjectRepository(UserWordSrsEntity)
    private readonly srsRepo: Repository<UserWordSrsEntity>,
    @InjectRepository(StoryEntity)
    private readonly storyRepo: Repository<StoryEntity>,
    @InjectRepository(WordEntity)
    private readonly wordRepo: Repository<WordEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(VocabularyItemEntity)
    private readonly vocabRepo: Repository<VocabularyItemEntity>,
    @InjectRepository(WordTranslationEntity)
    private readonly translationRepo: Repository<WordTranslationEntity>,
    @InjectQueue(WORD_BOOSTER_QUEUE)
    private readonly queue: Queue,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ── GET /word-booster/today ────────────────────────────────────────────────
  @Get('today')
  @ApiOperation({ summary: 'Get today\'s word swipe deck (SRS + new words)' })
  async getTodayWords(@CurrentUser() user: UserEntity) {
    // Kullanıcının uygulamada seçtiği seviye (cefrLevel) kaynak alınır
    const level = user.cefrLevel || user.notificationLevel || 'A1';
    const limit = user.wordNotificationCount || 5;
    const language = user.language ?? 'tr';

    const words = await this.sessionService.getTodayWords(user.id, level, limit, language);
    return { words, total: words.length };
  }

  // ── POST /word-booster/swipe ───────────────────────────────────────────────
  @Post('swipe')
  @ApiOperation({ summary: 'Record a swipe (left=unknown, right=known) and update SRS' })
  async recordSwipe(
    @Body() dto: SwipeDto,
    @CurrentUser() user: UserEntity,
  ) {
    const { wordId, direction } = dto;
    const remembered = direction === 'right';

    // Find or create SRS record
    let srs = await this.srsRepo.findOne({ where: { userId: user.id, wordId } });
    if (!srs) {
      srs = this.srsRepo.create({
        userId: user.id,
        wordId,
        status: 'unknown',
        intervalLevel: 0,
        easeFactor: 2.5,
        reviewCount: 0,
      });
    }

    srs.reviewCount += 1;
    srs.lastReviewedAt = new Date();
    srs.easeFactor = this.srsService.updateEaseFactor(srs.easeFactor, remembered);

    if (remembered) {
      // ── Swiped RIGHT (Biliyorum) ──
      const { nextLevel, nextReviewAt } = this.srsService.computeNextReviewForKnown(srs.intervalLevel);
      srs.intervalLevel = nextLevel;
      srs.nextReviewAt = nextReviewAt;
      srs.status = this.srsService.isMastered(nextLevel) ? 'mastered' : 'known';
    } else {
      // ── Swiped LEFT (Bilmiyorum) ──
      srs.intervalLevel = 0;
      srs.status = 'unknown';
      srs.nextReviewAt = null; // will re-appear next session too

      // Schedule SRS retry push notifications: +10min, +1hr, +1day
      await this.scheduleSrsRetries(user, wordId);
    }

    await this.srsRepo.save(srs);

    // ── Auto-save to vocabulary bank ──────────────────────────────────────
    await this.upsertVocabulary(user, wordId, srs.status);

    return {
      status: srs.status,
      intervalLevel: srs.intervalLevel,
      nextReviewAt: srs.nextReviewAt,
      mastered: srs.status === 'mastered',
    };
  }

  // ── GET /word-booster/story/today ─────────────────────────────────────────
  @Get('story/today')
  @ApiOperation({ summary: 'Get today\'s daily story and how many new words wait for the next one' })
  async getTodayStory(@CurrentUser() user: UserEntity) {
    const today = this.getToday();
    const [story, unknownWords, generatedToday] = await Promise.all([
      this.storyRepo.findOne({ where: { userId: user.id, storyDate: today } }),
      this.getTodayUnknownWords(user.id),
      this.storyGenerationsToday(user.id, today),
    ]);

    const pendingWords = story ? unknownWords.filter((w) => !story.words.includes(w)) : unknownWords;
    const threshold = this.storyThreshold(user, story);
    const canRegenerate = pendingWords.length >= threshold && generatedToday < STORY_RULES.dailyCap;

    return {
      story,
      unknownWords: story ? story.words : unknownWords,
      pendingWords: pendingWords.length,
      threshold,
      canRegenerate,
    };
  }

  // ── POST /word-booster/story/generate ─────────────────────────────────────
  @Post('story/generate')
  @ApiOperation({ summary: 'Generate a daily story from today\'s unknown words (rate limited)' })
  async generateStory(@CurrentUser() user: UserEntity) {
    const today = this.getToday();

    const [existing, unknownWords] = await Promise.all([
      this.storyRepo.findOne({ where: { userId: user.id, storyDate: today } }),
      this.getTodayUnknownWords(user.id),
    ]);

    if (unknownWords.length === 0) {
      return { story: existing ?? null, reason: 'no_words', message: 'Bugün henüz bilmediğin kelime yok!' };
    }

    const pendingWords = existing ? unknownWords.filter((w) => !existing.words.includes(w)) : unknownWords;
    if (existing && pendingWords.length === 0) {
      return { story: existing, reason: 'up_to_date', pendingWords: 0 };
    }

    const threshold = this.storyThreshold(user, existing);
    if (existing && pendingWords.length < threshold) {
      return { story: existing, reason: 'not_enough_new_words', pendingWords: pendingWords.length, threshold };
    }

    const generatedToday = await this.storyGenerationsToday(user.id, today);
    if (generatedToday >= STORY_RULES.dailyCap) {
      return { story: existing ?? null, reason: 'daily_limit', pendingWords: pendingWords.length, threshold };
    }

    // Gemini ile hikâye üret (yalnızca bu noktada maliyet oluşur)
    const language = (user.language ?? 'tr') as 'en' | 'tr';
    let generated: { title: string; content: string; wordHighlights: string[] };
    try {
      generated = await this.geminiService.generateDailyStory({
        words: unknownWords,
        cefrLevel: user.cefrLevel ?? 'B1',
        language,
        userInterests: user.interests ?? [],
      });
    } catch (err: any) {
      // Üretim başarısız: kayıt yok, günlük hak tüketilmez
      this.logger.warn(`Story generation failed for user ${user.id}: ${err?.message}`);
      return { story: existing ?? null, reason: 'error', pendingWords: pendingWords.length, threshold };
    }

    // One story per user per day (unique index) — overwrite today's row when regenerating
    const story = this.storyRepo.merge(existing ?? this.storyRepo.create({ userId: user.id, storyDate: today }), {
      title: generated.title,
      content: generated.content,
      words: unknownWords,
      wordHighlights: generated.wordHighlights,
    });

    await this.storyRepo.save(story);
    await this.incrementStoryGenerations(user.id, today);
    return { story, reason: 'generated', pendingWords: 0 };
  }

  /** Yeniden üretim eşiği: ilk hikâye için 1 kelime yeterli, sonrakiler için kullanıcı tipine göre. */
  private storyThreshold(user: UserEntity, existing: StoryEntity | null): number {
    if (!existing) return 1;
    return user.isSubscribed ? STORY_RULES.subscriberThreshold : STORY_RULES.freeThreshold;
  }

  private storyCountKey(userId: string, day: string): string {
    return `story:gen:${userId}:${day}`;
  }

  /** Redis hatasında 0 döner (üretimi engellemez). */
  private async storyGenerationsToday(userId: string, day: string): Promise<number> {
    try {
      return Number((await this.redis.get(this.storyCountKey(userId, day))) ?? 0);
    } catch (err: any) {
      this.logger.warn(`Story generation counter read failed: ${err?.message}`);
      return 0;
    }
  }

  private async incrementStoryGenerations(userId: string, day: string): Promise<void> {
    const key = this.storyCountKey(userId, day);
    try {
      await this.redis.multi().incr(key).expire(key, 2 * 86_400).exec();
    } catch (err: any) {
      this.logger.warn(`Story generation counter update failed: ${err?.message}`);
    }
  }

  private hasNewWords(storyWords: string[], unknownWords: string[]): boolean {
    const inStory = new Set(storyWords);
    return unknownWords.some((w) => !inStory.has(w));
  }

  // ── PATCH /word-booster/profession ────────────────────────────────────────
  @Post('profession')
  @ApiOperation({ summary: 'Update user profession for sectoral examples' })
  async updateProfession(
    @Body() dto: UpdateProfessionDto,
    @CurrentUser() user: UserEntity,
  ) {
    await this.userRepo.update(user.id, { profession: dto.profession });
    return { profession: dto.profession };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Upsert the swiped word into vocabulary_items.
   * - If not yet saved → create with appropriate status.
   * - If already saved → upgrade status only if it improves (learning → mastered).
   */
  private async upsertVocabulary(
    user: UserEntity,
    wordId: string,
    srsStatus: 'unknown' | 'known' | 'mastered' | 'unseen',
  ): Promise<void> {
    try {
      const word = await this.wordRepo.findOne({ where: { id: wordId } });
      if (!word) return;

      // Fetch translation in user's language
      const lang = user.language ?? 'tr';
      const translation = await this.translationRepo.findOne({
        where: { wordId, language: lang },
      });

      // Map SRS status → vocabulary status
      const vocabStatus: VocabularyStatus =
        srsStatus === 'mastered' ? VocabularyStatus.MASTERED : VocabularyStatus.LEARNING;

      const existing = await this.vocabRepo.findOne({
        where: { word: word.word.toLowerCase(), userId: user.id },
      });

      if (!existing) {
        // Create new entry
        const item = this.vocabRepo.create({
          word: word.word.toLowerCase(),
          translation: translation?.meaning ?? null,
          exampleSentence: translation?.exampleSentence ?? null,
          status: vocabStatus,
          userId: user.id,
        });
        await this.vocabRepo.save(item);
      } else {
        // Only upgrade status (never downgrade: mastered stays mastered)
        const rankMap: Record<VocabularyStatus, number> = {
          [VocabularyStatus.NEW]: 0,
          [VocabularyStatus.LEARNING]: 1,
          [VocabularyStatus.MASTERED]: 2,
        };
        if (rankMap[vocabStatus] > rankMap[existing.status]) {
          existing.status = vocabStatus;
          await this.vocabRepo.save(existing);
        }
      }
    } catch (err) {
      // Vocabulary save failure should never block the swipe response
      this.logger.warn(`upsertVocabulary failed for wordId=${wordId}: ${err.message}`);
    }
  }

  private async scheduleSrsRetries(user: UserEntity, wordId: string): Promise<void> {
    if (!user.fcmToken || !user.isWordNotificationEnabled) return;

    const word = await this.wordRepo.findOne({ where: { id: wordId } });
    if (!word) return;

    const delays = this.srsService.getRetryDelaysMs();
    const ts = Date.now();

    await this.queue.addBulk(
      delays.map((delayMs, i) => ({
        name: 'send-word',
        data: {
          userId: user.id,
          wordId,
          word: word.word,
          level: word.level,
          delayMs,
          jobIndex: i + 1,
          totalJobs: delays.length,
        },
        opts: {
          delay: delayMs,
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 20 },
          // srs_ prefix distinguishes from daily wb_ jobs — bypasses daily guard
          jobId: `srs_${user.id}_${wordId}_${ts}_${i}`,
        },
      })),
    );

    this.logger.log(
      `SRS retries scheduled for user ${user.id}, word "${word.word}": +10min, +1hr, +1day`,
    );
  }

  private async getTodayUnknownWords(userId: string): Promise<string[]> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const records = await this.srsRepo
      .createQueryBuilder('srs')
      .innerJoinAndSelect('srs.word', 'w')
      .where('srs.userId = :userId', { userId })
      .andWhere('srs.status = :status', { status: 'unknown' })
      .andWhere('srs.last_reviewed_at >= :startOfDay', { startOfDay })
      .orderBy('srs.last_reviewed_at', 'DESC')
      .limit(10)
      .getMany();

    return records.map((r) => r.word.word);
  }

  private getToday(): string {
    return new Date().toISOString().split('T')[0];
  }
}
