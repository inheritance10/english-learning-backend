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

    // Summary stats
    const totalXp = dailyProgress.reduce((sum, p) => sum + p.xpEarned, 0);
    const totalQuestions = dailyProgress.reduce((sum, p) => sum + p.questionsAnswered, 0);
    const totalCorrect = dailyProgress.reduce((sum, p) => sum + p.correctAnswers, 0);
    const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    // Weekly activity for chart (last 7 days)
    const weeklyActivity = this.buildWeeklyActivity(dailyProgress);

    return {
      summary: {
        totalXp,
        accuracy,
        currentStreak: streakData?.currentStreak ?? 0,
        longestStreak: streakData?.longestStreak ?? 0,
        totalDaysActive: dailyProgress.length,
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
      const record = records.find(r => r.date === date);
      return {
        date,
        xpEarned: record?.xpEarned ?? 0,
        questionsAnswered: record?.questionsAnswered ?? 0,
        active: !!record,
      };
    });
  }
}
