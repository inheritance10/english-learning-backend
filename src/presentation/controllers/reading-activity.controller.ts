import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UserEntity } from '../../domain/entities/user.entity';
import { ReadingActivityEntity } from '../../domain/entities/reading-activity.entity';
import { GenerateReadingUseCase } from '../../application/reading-activity/use-cases/generate-reading.use-case';
import { SubmitReadingUseCase } from '../../application/reading-activity/use-cases/submit-reading.use-case';
import {
  GenerateReadingDto,
  SubmitReadingDto,
} from '../dtos/reading-activity.dto';

@ApiTags('reading-activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reading-activity')
export class ReadingActivityController {
  constructor(
    private readonly generateReading: GenerateReadingUseCase,
    private readonly submitReading: SubmitReadingUseCase,
    @InjectRepository(ReadingActivityEntity)
    private readonly repo: Repository<ReadingActivityEntity>,
  ) {}

  // ── POST /reading-activity/generate ────────────────────────────────────
  @Post('generate')
  @ApiOperation({
    summary:
      "Generate a personalized AI reading passage + comprehension questions for the user's interest & CEFR level.",
  })
  async generate(
    @Body() dto: GenerateReadingDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.generateReading.execute(dto, user);
  }

  // ── GET /reading-activity/:id ─────────────────────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Fetch a previously-generated reading activity by id.' })
  async getOne(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<ReadingActivityEntity> {
    const activity = await this.repo.findOne({ where: { id } });
    if (!activity) throw new NotFoundException('Reading activity not found');
    if (activity.userId !== user.id)
      throw new ForbiddenException('Activity does not belong to user');
    return activity;
  }

  // ── POST /reading-activity/:id/submit ─────────────────────────────────
  @Post(':id/submit')
  @ApiOperation({
    summary:
      "Submit user's answers, mark activity complete, award tokens, and return per-question result.",
  })
  async submit(
    @Param('id') id: string,
    @Body() dto: SubmitReadingDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.submitReading.execute(id, dto, user);
  }
}
