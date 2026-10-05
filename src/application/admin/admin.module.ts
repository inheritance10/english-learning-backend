import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdminController } from '../../presentation/controllers/admin.controller';
import { AdminQueriesUseCase } from './use-cases/admin-queries.use-case';
import { AdminKeyGuard } from '../../infrastructure/auth/admin-key.guard';
import { QUESTION_POOL_QUEUE } from '../question-pool/question-pool.producer';
import { WORD_BOOSTER_QUEUE } from '../notifications/word-booster.producer';
import { EXAM_PREP_QUEUE } from '../exam-prep/exam-prep.producer';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUESTION_POOL_QUEUE }),
    BullModule.registerQueue({ name: WORD_BOOSTER_QUEUE }),
    BullModule.registerQueue({ name: EXAM_PREP_QUEUE }),
  ],
  controllers: [AdminController],
  providers: [AdminQueriesUseCase, AdminKeyGuard],
})
export class AdminModule {}
