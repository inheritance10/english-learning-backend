import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WritingActivityEntity } from '../../domain/entities/writing-activity.entity';
import { WritingTaskEntity } from '../../domain/entities/writing-task.entity';
import { UserEntity } from '../../domain/entities/user.entity';
import { GeminiService } from '../../infrastructure/gemini/gemini.service';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { ProgressModule } from '../progress/progress.module';
import { StartWritingUseCase } from './use-cases/start-writing.use-case';
import { SubmitWritingTurnUseCase } from './use-cases/submit-writing-turn.use-case';
import { GetWritingQuotaUseCase } from './use-cases/get-writing-quota.use-case';
import { WritingController } from '../../presentation/controllers/writing.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([WritingActivityEntity, WritingTaskEntity, UserEntity]),
    AuthModule,
    SubscriptionModule,
    ProgressModule,
  ],
  controllers: [WritingController],
  providers: [GeminiService, StartWritingUseCase, SubmitWritingTurnUseCase, GetWritingQuotaUseCase],
})
export class WritingModule {}
