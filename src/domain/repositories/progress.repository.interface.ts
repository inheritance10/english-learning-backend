import { UserProgressEntity } from '../entities/user-progress.entity';
import { DailyStreakEntity } from '../entities/daily-streak.entity';

export interface IProgressRepository {
  findByUser(userId: string): Promise<UserProgressEntity[]>;
  findByUserAndTopic(userId: string, topicId: string): Promise<UserProgressEntity | null>;
  upsert(data: Partial<UserProgressEntity>): Promise<UserProgressEntity>;
  getCurrentStreak(userId: string): Promise<number>;
  recordDailyActivity(userId: string, data: Partial<DailyStreakEntity>): Promise<DailyStreakEntity>;
  getStreakHistory(userId: string, days: number): Promise<DailyStreakEntity[]>;
  getDashboardStats(userId: string): Promise<{
    totalQuestions: number;
    correctAnswers: number;
    topicsCompleted: number;
    currentStreak: number;
    longestStreak: number;
    totalMinutesStudied: number;
  }>;
}

export const PROGRESS_REPOSITORY = 'PROGRESS_REPOSITORY';
