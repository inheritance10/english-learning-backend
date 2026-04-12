import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeminiService } from '../../../infrastructure/gemini/gemini.service';
import { VocabularyItemEntity, VocabularyStatus } from '../../../domain/entities/vocabulary-item.entity';
import { UserProgressEntity } from '../../../domain/entities/user-progress.entity';
import { UserEntity } from '../../../domain/entities/user.entity';

export interface AnalyzeAnswerDto {
  question: string;
  correctAnswer: string;
  userAnswer: string;
  word?: string;
  translation?: string;
  topicId: string;
}

@Injectable()
export class AnalyzeAnswerUseCase {
  constructor(
    private readonly gemini: GeminiService,
    @InjectRepository(VocabularyItemEntity)
    private readonly vocabRepo: Repository<VocabularyItemEntity>,
    @InjectRepository(UserProgressEntity)
    private readonly progressRepo: Repository<UserProgressEntity>,
  ) {}

  async execute(dto: AnalyzeAnswerDto, user: UserEntity) {
    const analysis = await this.gemini.analyzeAnswer({
      question: dto.question,
      correctAnswer: dto.correctAnswer,
      userAnswer: dto.userAnswer,
      cefrLevel: user.cefrLevel ?? 'B1',
      language: user.language as 'en' | 'tr',
    });

    // Save wrong answer word to vocabulary bank
    if (!analysis.isCorrect && dto.word) {
      const existing = await this.vocabRepo.findOne({
        where: { userId: user.id, word: dto.word },
      });
      if (!existing) {
        await this.vocabRepo.save(
          this.vocabRepo.create({
            userId: user.id,
            word: dto.word,
            translation: dto.translation ?? '',
            definition: analysis.rule,
            exampleSentence: analysis.example,
            status: VocabularyStatus.LEARNING,
            topicId: dto.topicId,
          }),
        );
      }
    }

    // Update XP in progress
    const today = new Date().toISOString().split('T')[0];
    let progress = await this.progressRepo.findOne({
      where: { userId: user.id, date: today },
    });
    if (!progress) {
      progress = this.progressRepo.create({ userId: user.id, date: today, xpEarned: 0, questionsAnswered: 0, correctAnswers: 0 });
    }
    progress.xpEarned += analysis.xpEarned;
    progress.questionsAnswered += 1;
    if (analysis.isCorrect) progress.correctAnswers += 1;
    await this.progressRepo.save(progress);

    return analysis;
  }
}
