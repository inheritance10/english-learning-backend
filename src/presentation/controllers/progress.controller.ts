import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNumber, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UserEntity } from '../../domain/entities/user.entity';
import { GetProgressUseCase } from '../../application/progress/use-cases/get-progress.use-case';
import { UpdateStreakUseCase, RecordProgressDto } from '../../application/progress/use-cases/update-streak.use-case';

class RecordProgressDtoInput {
  @IsString()
  topicId: string;

  @IsNumber()
  @Min(0)
  correctAnswers: number;

  @IsNumber()
  @Min(1)
  @Max(100)
  totalQuestions: number;
}

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

  @Post('record')
  @ApiOperation({ summary: 'Record quiz progress and calculate tokens/streak' })
  async recordProgress(@CurrentUser() user: UserEntity, @Body() dto: RecordProgressDtoInput) {
    return this.updateStreak.recordProgress(user.id, dto);
  }

  @Get('streak')
  @ApiOperation({ summary: 'Get current streak information' })
  async getStreak(@CurrentUser() user: UserEntity) {
    return this.updateStreak.getStreak(user.id);
  }
}
