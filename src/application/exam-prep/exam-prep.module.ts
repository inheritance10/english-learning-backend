import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ExamEntity } from '../../domain/entities/exam.entity';
import { ExamCategoryEntity } from '../../domain/entities/exam-category.entity';
import { QuestionEntity } from '../../domain/entities/question.entity';
import { UserExamAttemptEntity } from '../../domain/entities/user-exam-attempt.entity';
import { AiGeneratedVariantEntity } from '../../domain/entities/ai-generated-variant.entity';
import { UserEntity } from '../../domain/entities/user.entity';
import { VocabularyItemEntity } from '../../domain/entities/vocabulary-item.entity';
import { GeminiService } from '../../infrastructure/gemini/gemini.service';
import { AuthModule } from '../auth/auth.module';
import { ExamPrepService } from './exam-prep.service';
import { ExamPrepController } from './exam-prep.controller';
import { ExamPrepConsumer } from './exam-prep.consumer';
import { ExamPrepProducer } from './exam-prep.producer';
import { EXAM_PREP_QUEUE } from './exam-prep.producer';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExamEntity,
      ExamCategoryEntity,
      QuestionEntity,
      UserExamAttemptEntity,
      AiGeneratedVariantEntity,
      UserEntity,
      VocabularyItemEntity,
    ]),
    BullModule.registerQueue({ name: EXAM_PREP_QUEUE }),
    AuthModule,
  ],
  controllers: [ExamPrepController],
  providers: [ExamPrepService, GeminiService, ExamPrepConsumer, ExamPrepProducer],
  exports: [ExamPrepService],
})
export class ExamPrepModule {}
