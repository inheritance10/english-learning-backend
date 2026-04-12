import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DailyStreakEntity } from '../../../domain/entities/daily-streak.entity';
import { UserProgressEntity } from '../../../domain/entities/user-progress.entity';
import { UserEntity } from '../../../domain/entities/user.entity';

@Injectable()
export class UpdateStreakUseCase {
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
      if (streak.currentStreak > streak.longestStreak) {
        streak.longestStreak = streak.currentStreak;
      }
      await this.streakRepo.save(streak);
    }

    return { currentStreak: streak.currentStreak, isNewDay };
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
