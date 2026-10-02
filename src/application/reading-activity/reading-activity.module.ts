import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReadingActivityEntity } from '../../domain/entities/reading-activity.entity';
import { ReadingPassageEntity } from '../../domain/entities/reading-passage.entity';
import { UserEntity } from '../../domain/entities/user.entity';
import { GenerateReadingUseCase } from './use-cases/generate-reading.use-case';
import { SubmitReadingUseCase } from './use-cases/submit-reading.use-case';
import { GetReadingQuotaUseCase } from './use-cases/get-reading-quota.use-case';
import { ReadingActivityController } from '../../presentation/controllers/reading-activity.controller';
import { GeminiService } from '../../infrastructure/gemini/gemini.service';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { ProgressModule } from '../progress/progress.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReadingActivityEntity, ReadingPassageEntity, UserEntity]),
    AuthModule,
    SubscriptionModule,
    ProgressModule,
  ],
  controllers: [ReadingActivityController],
  providers: [GenerateReadingUseCase, SubmitReadingUseCase, GetReadingQuotaUseCase, GeminiService],
})
export class ReadingActivityModule {}
