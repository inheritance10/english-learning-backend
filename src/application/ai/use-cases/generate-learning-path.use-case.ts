import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeminiService } from '../../../infrastructure/gemini/gemini.service';
import { UserProgressEntity } from '../../../domain/entities/user-progress.entity';
import { UserEntity } from '../../../domain/entities/user.entity';

@Injectable()
export class GenerateLearningPathUseCase {
  constructor(
    private readonly gemini: GeminiService,
    @InjectRepository(UserProgressEntity)
    private readonly progressRepo: Repository<UserProgressEntity>,
  ) {}

  async execute(user: UserEntity) {
    // Get completed topics from progress records
    const completedRecords = await this.progressRepo
      .createQueryBuilder('progress')
      .select('DISTINCT progress.topicId')
      .where('progress.userId = :userId', { userId: user.id })
      .andWhere('progress.isCompleted = :completed', { completed: true })
      .getRawMany();

    const completedTopics = completedRecords.map(r => r.topicId).filter(Boolean);

    const path = await this.gemini.generateLearningPath({
      cefrLevel: user.cefrLevel ?? 'B1',
      interests: user.interests ?? [],
      completedTopics,
      language: user.language as 'en' | 'tr',
    });

    return { learningPath: path, completedCount: completedTopics.length };
  }
}
