import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WritingActivityEntity } from '../../domain/entities/writing-activity.entity';
import { WritingTaskEntity } from '../../domain/entities/writing-task.entity';
import { TopicEntity } from '../../domain/entities/topic.entity';
import { ScrambleSentenceEntity } from '../../domain/entities/scramble-sentence.entity';
import { UserEntity } from '../../domain/entities/user.entity';
import { RewardPurchaseEntity } from '../../domain/entities/reward-purchase.entity';
import { GeminiService } from '../../infrastructure/gemini/gemini.service';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { ProgressModule } from '../progress/progress.module';
import { StartWritingUseCase } from './use-cases/start-writing.use-case';
import { SubmitWritingTurnUseCase } from './use-cases/submit-writing-turn.use-case';
import { GetWritingQuotaUseCase } from './use-cases/get-writing-quota.use-case';
import { BuildScrambleTaskUseCase } from './use-cases/build-scramble-task.use-case';
import { WritingController } from '../../presentation/controllers/writing.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WritingActivityEntity,
      WritingTaskEntity,
      TopicEntity,
      ScrambleSentenceEntity,
      UserEntity,
      RewardPurchaseEntity,
    ]),
    AuthModule,
    SubscriptionModule,
    ProgressModule,
  ],
  controllers: [WritingController],
  providers: [
    GeminiService,
    StartWritingUseCase,
    SubmitWritingTurnUseCase,
    GetWritingQuotaUseCase,
    BuildScrambleTaskUseCase,
  ],
})
export class WritingModule {}
