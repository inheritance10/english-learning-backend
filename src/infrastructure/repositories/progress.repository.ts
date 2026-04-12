import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProgressEntity } from '../../domain/entities/user-progress.entity';
import { DailyStreakEntity } from '../../domain/entities/daily-streak.entity';

@Injectable()
export class ProgressRepository {
  constructor(
    @InjectRepository(UserProgressEntity)
    private readonly progressRepo: Repository<UserProgressEntity>,
    @InjectRepository(DailyStreakEntity)
    private readonly streakRepo: Repository<DailyStreakEntity>,
  ) {}

  findByUser(userId: string) {
    return this.progressRepo.find({ where: { userId } });
  }

  findByUserAndTopic(userId: string, topicId: string) {
    return this.progressRepo.findOne({ where: { userId, topicId } });
  }

  async upsert(data: Partial<UserProgressEntity>) {
    const existing = await this.findByUserAndTopic(data.userId!, data.topicId!);
    if (existing) {
      await this.progressRepo.update(existing.id, data);
      return this.progressRepo.findOne({ where: { id: existing.id } });
    }
    return this.progressRepo.save(this.progressRepo.create(data));
  }

  getStreakForUser(userId: string) {
    return this.streakRepo.findOne({ where: { userId } });
  }

  async getDashboardStats(userId: string) {
    const progressRecords = await this.findByUser(userId);
    const streakRecord = await this.getStreakForUser(userId);

    const totalQuestionsAnswered = progressRecords.reduce((s, p) => s + p.questionsAnswered, 0);
    const totalCorrect = progressRecords.reduce((s, p) => s + p.correctAnswers, 0);
    const topicsCompleted = progressRecords.filter((p) => p.isCompleted).length;
    const currentStreak = streakRecord?.currentStreak ?? 0;
    const longestStreak = streakRecord?.longestStreak ?? 0;

    return { totalQuestionsAnswered, totalCorrect, topicsCompleted, currentStreak, longestStreak };
  }
}
