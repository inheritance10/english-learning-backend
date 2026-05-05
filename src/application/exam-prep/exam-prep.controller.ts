import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../presentation/decorators/current-user.decorator';
import { UserEntity } from '../../domain/entities/user.entity';
import { ExamPrepService } from './exam-prep.service';
import { ImportQuestionDto } from './dto/import-question.dto';

class CheckAnswerDto {
  @IsNumber()
  selectedIndex: number;

  @IsOptional()
  @IsNumber()
  timeSpentMs?: number;
}

class GetQuestionsQueryDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}

class BulkImportDto {
  questions: ImportQuestionDto[];
}

@ApiTags('exam-prep')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ExamPrepController {
  private readonly logger = new Logger(ExamPrepController.name);

  constructor(private readonly examPrepService: ExamPrepService) {}

  @Get('exams')
  @ApiOperation({ summary: 'Get all active exams' })
  async getExams() {
    return this.examPrepService.getExams();
  }

  @Get('exams/:id/categories')
  @ApiOperation({ summary: 'Get categories for an exam' })
  async getCategories(@Param('id') id: string) {
    return this.examPrepService.getCategories(id);
  }

  @Get('exams/:id/questions')
  @ApiOperation({ summary: 'Get paginated questions for an exam' })
  async getQuestions(
    @Param('id') id: string,
    @Query() query: GetQuestionsQueryDto,
  ) {
    return this.examPrepService.getQuestions(id, {
      categoryId: query.categoryId,
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    });
  }

  @Post('questions/:id/check')
  @ApiOperation({ summary: 'Check answer, record attempt, get AI variant if wrong' })
  async checkAnswer(
    @Param('id') id: string,
    @Body() dto: CheckAnswerDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.examPrepService.checkAnswer(
      user,
      id,
      dto.selectedIndex,
      dto.timeSpentMs ?? 0,
    );
  }

  @Get('analytics/weak-points')
  @ApiOperation({ summary: "Get user's weak points grouped by topic tag" })
  async getWeakPoints(@CurrentUser() user: UserEntity) {
    return this.examPrepService.getWeakPoints(user.id);
  }

  @Post('exams/import')
  @ApiOperation({ summary: 'Bulk import questions' })
  async bulkImport(@Body() dto: BulkImportDto) {
    return this.examPrepService.bulkImport(dto.questions);
  }
}
