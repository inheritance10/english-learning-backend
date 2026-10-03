import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UserEntity } from '../../domain/entities/user.entity';
import { SubmitFeedbackUseCase } from '../../application/feedback/use-cases/submit-feedback.use-case';
import type { FeedbackType } from '../../domain/entities/feedback.entity';

class SubmitFeedbackDto {
  @IsIn(['suggestion', 'complaint', 'bug'])
  type: FeedbackType;

  @IsString()
  @Length(5, 2000)
  message: string;

  @IsBoolean()
  shareEmail: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  appVersion?: string;
}

@ApiTags('feedback')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly submitFeedback: SubmitFeedbackUseCase) {}

  @Post()
  @ApiOperation({ summary: 'Send a suggestion, complaint or bug report' })
  submit(@Body() dto: SubmitFeedbackDto, @CurrentUser() user: UserEntity) {
    return this.submitFeedback.execute(dto, user);
  }
}
