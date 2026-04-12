import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsNumber, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UserEntity } from '../../domain/entities/user.entity';
import { GenerateQuizUseCase } from '../../application/ai/use-cases/generate-quiz.use-case';
import { AnalyzeAnswerUseCase } from '../../application/ai/use-cases/analyze-answer.use-case';
import { LessonChatUseCase } from '../../application/ai/use-cases/lesson-chat.use-case';
import { GenerateLearningPathUseCase } from '../../application/ai/use-cases/generate-learning-path.use-case';

class GenerateQuizDto {
  @IsString()
  topicId: string;

  @IsOptional()
  @IsString()
  topicName?: string; // fallback name if topicId not in DB

  @IsOptional()
  @IsNumber()
  @Min(3)
  @Max(20)
  questionCount?: number;

  @IsOptional()
  @IsString()
  cefrLevel?: string; // override user's level
}

class AnalyzeAnswerDto {
  @IsString()
  question: string;

  @IsString()
  correctAnswer: string;

  @IsString()
  userAnswer: string;

  @IsString()
  topicId: string;

  @IsOptional()
  @IsString()
  word?: string;

  @IsOptional()
  @IsString()
  translation?: string;
}

class ChatMessageDto {
  @IsString()
  role: 'user' | 'model';

  @IsString()
  content: string;
}

class LessonChatDto {
  @IsString()
  topicId: string;

  @IsOptional()
  @IsString()
  topicName?: string; // fallback name if topicId not in DB

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];
}

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly generateQuiz: GenerateQuizUseCase,
    private readonly analyzeAnswer: AnalyzeAnswerUseCase,
    private readonly lessonChat: LessonChatUseCase,
    private readonly learningPath: GenerateLearningPathUseCase,
  ) {}

  @Post('quiz/generate')
  @ApiOperation({ summary: 'Generate personalized quiz questions for a topic' })
  async generate(@Body() dto: GenerateQuizDto, @CurrentUser() user: UserEntity) {

    return this.generateQuiz.execute(dto, user);
  }

  @Post('quiz/analyze')
  @ApiOperation({ summary: 'Analyze a quiz answer with Socratic feedback' })
  async analyze(@Body() dto: AnalyzeAnswerDto, @CurrentUser() user: UserEntity) {
    return this.analyzeAnswer.execute(dto, user);
  }

  @Post('lesson/chat')
  @ApiOperation({ summary: 'Lesson chat with AI tutor — returns full reply as JSON' })
  async chat(
    @Body() dto: LessonChatDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.lessonChat.execute(dto, user);
  }

  @Get('learning-path')
  @ApiOperation({ summary: 'Generate personalized learning path' })
  async getLearningPath(@CurrentUser() user: UserEntity) {
    return this.learningPath.execute(user);
  }
}
