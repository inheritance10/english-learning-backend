import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizQuestionEntity } from '../../domain/entities/quiz-question.entity';
import { UserProgressEntity } from '../../domain/entities/user-progress.entity';
import { VocabularyItemEntity } from '../../domain/entities/vocabulary-item.entity';
import { TopicEntity } from '../../domain/entities/topic.entity';
import { GeminiService } from '../../infrastructure/gemini/gemini.service';
import { GenerateQuizUseCase } from './use-cases/generate-quiz.use-case';
import { AnalyzeAnswerUseCase } from './use-cases/analyze-answer.use-case';
import { LessonChatUseCase } from './use-cases/lesson-chat.use-case';
import { GenerateLearningPathUseCase } from './use-cases/generate-learning-path.use-case';
import { AiController } from '../../presentation/controllers/ai.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([QuizQuestionEntity, UserProgressEntity, VocabularyItemEntity, TopicEntity]),
    AuthModule,
  ],
  controllers: [AiController],
  providers: [GeminiService, GenerateQuizUseCase, AnalyzeAnswerUseCase, LessonChatUseCase, GenerateLearningPathUseCase],
  exports: [GeminiService],
})
export class AiModule {}
