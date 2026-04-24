import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DailyStreakEntity } from '../../../domain/entities/daily-streak.entity';
import { UserProgressEntity } from '../../../domain/entities/user-progress.entity';
import { UserEntity } from '../../../domain/entities/user.entity';

export interface RecordProgressDto {
  topicId: string;
  correctAnswers: number;
  totalQuestions: number;
}

export interface ProgressResult {
  tokensEarned: number;
  totalTokens: number;
  currentStreak: number;
  longestStreak: number;
  dailyRewardClaimed: boolean;
  streakBonus: number;
}

@Injectable()
export class UpdateStreakUseCase {
  // Token reward per correct answer
  private static readonly TOKEN_PER_CORRECT = 10;

  // Streak bonuses (days -> bonus tokens)
  private static readonly STREAK_BONUSES: Record<number, number> = {
    7: 50, // 7 days streak = 50 bonus tokens
    14: 100, // 14 days streak = 100 bonus tokens
    30: 250, // 30 days streak = 250 bonus tokens
  };

  constructor(
    @InjectRepository(DailyStreakEntity)
    private readonly streakRepo: Repository<DailyStreakEntity>,
    @InjectRepository(UserProgressEntity)
    private readonly progressRepo: Repository<UserProgressEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async recordActivity(userId: string): Promise<{ currentStreak: number; isNewDay: boolean }> {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    let streak = await this.streakRepo.findOne({ where: { userId } });
    if (!streak) {
      streak = this.streakRepo.create({ userId, currentStreak: 0, longestStreak: 0 });
    }

    const isNewDay = streak.lastActiveDate !== today;

    if (isNewDay) {
      if (streak.lastActiveDate === yesterday) {
        // Consecutive day — extend streak
        streak.currentStreak += 1;
      } else if (streak.lastActiveDate !== today) {
        // Streak broken — reset
        streak.currentStreak = 1;
      }
      streak.lastActiveDate = today;
      // Reset daily reward claim for new day
      streak.dailyRewardClaimed = false;
      if (streak.currentStreak > streak.longestStreak) {
        streak.longestStreak = streak.currentStreak;
      }
      await this.streakRepo.save(streak);
    }

    return { currentStreak: streak.currentStreak, isNewDay };
  }

  async recordProgress(userId: string, dto: RecordProgressDto): Promise<ProgressResult> {
    const today = new Date().toISOString().split('T')[0];

    // Record activity (updates streak)
    const { currentStreak, isNewDay } = await this.recordActivity(userId);

    // Get or create streak record
    let streak = await this.streakRepo.findOne({ where: { userId } });
    if (!streak) {
      streak = await this.streakRepo.save(
        this.streakRepo.create({ userId, currentStreak: 1, longestStreak: 1, lastActiveDate: today })
      );
    }

    // Get user
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    // ── Award tokens for every quiz completion ────────────────────────────
    // Each quiz attempt is stored as an independent record (no accumulation).
    // This allows the same topic to award tokens multiple times per day.
    const tokensAwarded = dto.correctAnswers * UpdateStreakUseCase.TOKEN_PER_CORRECT;
    user.totalTokens += tokensAwarded;
    await this.userRepo.save(user);

    const progress = this.progressRepo.create({
      userId,
      topicId: dto.topicId,
      date: today,
      questionsAnswered: dto.totalQuestions,
      correctAnswers: dto.correctAnswers,
      successRate: dto.totalQuestions > 0
        ? Math.round((dto.correctAnswers / dto.totalQuestions) * 100)
        : 0,
      tokensEarned: tokensAwarded,
      xpEarned: 0,
      isCompleted: dto.correctAnswers === dto.totalQuestions,
      timeSpentSeconds: 0,
    });
    await this.progressRepo.save(progress);

    // ── Daily login reward (once per day) ─────────────────────────────────
    let dailyRewardClaimed = streak.dailyRewardClaimed;
    if (isNewDay && !dailyRewardClaimed) {
      const dailyBonus = 5;
      user.totalTokens += dailyBonus;
      await this.userRepo.save(user);
      streak.dailyRewardClaimed = true;
      await this.streakRepo.save(streak);
      dailyRewardClaimed = true;
    }

    return {
      tokensEarned: tokensAwarded,
      totalTokens: user.totalTokens,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      dailyRewardClaimed,
      streakBonus: 0,
    };
  }

  async getStreak(userId: string): Promise<{ currentStreak: number; longestStreak: number; dailyRewardClaimed: boolean }> {
    let streak = await this.streakRepo.findOne({ where: { userId } });
    if (!streak) {
      streak = await this.streakRepo.save(
        this.streakRepo.create({ userId, currentStreak: 0, longestStreak: 0 })
      );
    }
    return {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      dailyRewardClaimed: streak.dailyRewardClaimed,
    };
  }

  /** Runs daily at midnight UTC — resets streaks for users who missed yesterday */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async resetBrokenStreaks() {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    await this.streakRepo
      .createQueryBuilder()
      .update(DailyStreakEntity)
      .set({ currentStreak: 0 })
      .where('lastActiveDate < :yesterday', { yesterday })
      .andWhere('currentStreak > 0')
      .execute();
  }
}
