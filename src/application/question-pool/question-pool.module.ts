import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { QuizQuestionEntity } from '../../domain/entities/quiz-question.entity';
import { UserSeenQuestionEntity } from '../../domain/entities/user-seen-question.entity';
import { TopicEntity } from '../../domain/entities/topic.entity';
import { GeminiService } from '../../infrastructure/gemini/gemini.service';
import { AuthModule } from '../auth/auth.module';
import { QUESTION_POOL_QUEUE } from './question-pool.producer';
import { QuestionPoolProducer } from './question-pool.producer';
import { QuestionPoolConsumer } from './question-pool.consumer';
import { QuestionPoolScheduler } from './question-pool.scheduler';
import { QuizPoolService } from './quiz-pool.service';
import { QuestionPoolController } from '../../presentation/controllers/question-pool.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QuizQuestionEntity,
      UserSeenQuestionEntity,
      TopicEntity,
    ]),
    BullModule.registerQueue({ name: QUESTION_POOL_QUEUE }),
    AuthModule,
  ],
  controllers: [QuestionPoolController],
  providers: [
    GeminiService,
    QuestionPoolProducer,
    QuestionPoolConsumer,
    QuestionPoolScheduler,
    QuizPoolService,
  ],
  exports: [QuizPoolService, QuestionPoolScheduler],
})
export class QuestionPoolModule {}
