import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProgressEntity } from '../../../domain/entities/user-progress.entity';
import { DailyStreakEntity } from '../../../domain/entities/daily-streak.entity';
import { UserEntity } from '../../../domain/entities/user.entity';

@Injectable()
export class GetProgressUseCase {
  constructor(
    @InjectRepository(UserProgressEntity)
    private readonly progressRepo: Repository<UserProgressEntity>,
    @InjectRepository(DailyStreakEntity)
    private readonly streakRepo: Repository<DailyStreakEntity>,
  ) {}

  async execute(user: UserEntity) {
    // Last 30 days progress
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyProgress = await this.progressRepo
      .createQueryBuilder('progress')
      .where('progress.userId = :userId', { userId: user.id })
      .andWhere('progress.date >= :from', { from: thirtyDaysAgo.toISOString().split('T')[0] })
      .orderBy('progress.date', 'DESC')
      .getMany();

    // Streak data
    const streakData = await this.streakRepo.findOne({ where: { userId: user.id } });

    // Summary stats — aggregate across all records (multiple per day are allowed)
    const totalQuestions = dailyProgress.reduce((sum, p) => sum + p.questionsAnswered, 0);
    const totalCorrect  = dailyProgress.reduce((sum, p) => sum + p.correctAnswers, 0);
    const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    // Unique active days (multiple quiz records on same day = 1 active day)
    const uniqueDates = new Set(dailyProgress.map(p => p.date));

    // Weekly activity for chart (last 7 days) — aggregate per day
    const weeklyActivity = this.buildWeeklyActivity(dailyProgress);

    return {
      summary: {
        totalXp: 0,  // XP removed — kept field for API compatibility
        accuracy,
        currentStreak: streakData?.currentStreak ?? 0,
        longestStreak: streakData?.longestStreak ?? 0,
        totalDaysActive: uniqueDates.size,
        totalQuestionsAnswered: totalQuestions,
      },
      weeklyActivity,
      dailyProgress: dailyProgress.slice(0, 7),
    };
  }

  private buildWeeklyActivity(records: UserProgressEntity[]) {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    return days.map(date => {
      // Aggregate all records for this day (may be multiple quizzes)
      const dayRecords = records.filter(r => r.date === date);
      return {
        date,
        xpEarned: 0,
        questionsAnswered: dayRecords.reduce((sum, r) => sum + r.questionsAnswered, 0),
        active: dayRecords.length > 0,
      };
    });
  }
}
