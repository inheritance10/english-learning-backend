import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UserEntity } from '../../domain/entities/user.entity';
import { GetProgressUseCase } from '../../application/progress/use-cases/get-progress.use-case';
import { UpdateStreakUseCase } from '../../application/progress/use-cases/update-streak.use-case';

@ApiTags('progress')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('progress')
export class ProgressController {
  constructor(
    private readonly getProgress: GetProgressUseCase,
    private readonly updateStreak: UpdateStreakUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get user progress dashboard (streaks, XP, accuracy)' })
  async getDashboard(@CurrentUser() user: UserEntity) {
    return this.getProgress.execute(user);
  }

  @Post('activity')
  @ApiOperation({ summary: 'Record daily activity and update streak' })
  async recordActivity(@CurrentUser() user: UserEntity) {
    return this.updateStreak.recordActivity(user.id);
  }
}
