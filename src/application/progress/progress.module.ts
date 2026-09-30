import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { UserProgressEntity } from '../../domain/entities/user-progress.entity';
import { DailyStreakEntity } from '../../domain/entities/daily-streak.entity';
import { UserEntity } from '../../domain/entities/user.entity';
import { ReadingActivityEntity } from '../../domain/entities/reading-activity.entity';
import { WritingActivityEntity } from '../../domain/entities/writing-activity.entity';
import { GetProgressUseCase } from './use-cases/get-progress.use-case';
import { UpdateStreakUseCase } from './use-cases/update-streak.use-case';
import { GetActivityStatsUseCase } from './use-cases/get-activity-stats.use-case';
import { GetActivityHistoryUseCase } from './use-cases/get-activity-history.use-case';
import { ProgressController } from '../../presentation/controllers/progress.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserProgressEntity,
      DailyStreakEntity,
      UserEntity,
      ReadingActivityEntity,
      WritingActivityEntity,
    ]),
    ScheduleModule,
    AuthModule,
  ],
  controllers: [ProgressController],
  providers: [GetProgressUseCase, UpdateStreakUseCase, GetActivityStatsUseCase, GetActivityHistoryUseCase],
  exports: [GetProgressUseCase, UpdateStreakUseCase, GetActivityStatsUseCase, GetActivityHistoryUseCase],
})
export class ProgressModule {}
