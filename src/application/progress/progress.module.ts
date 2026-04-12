import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { UserProgressEntity } from '../../domain/entities/user-progress.entity';
import { DailyStreakEntity } from '../../domain/entities/daily-streak.entity';
import { UserEntity } from '../../domain/entities/user.entity';
import { GetProgressUseCase } from './use-cases/get-progress.use-case';
import { UpdateStreakUseCase } from './use-cases/update-streak.use-case';
import { ProgressController } from '../../presentation/controllers/progress.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserProgressEntity, DailyStreakEntity, UserEntity]),
    ScheduleModule,
    AuthModule,
  ],
  controllers: [ProgressController],
  providers: [GetProgressUseCase, UpdateStreakUseCase],
  exports: [GetProgressUseCase, UpdateStreakUseCase],
})
export class ProgressModule {}
