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
import { WritingActivityEntity } from '../../domain/entities/writing-activity.entity';
import { GenerateScenarioUseCase } from '../../application/writing/use-cases/generate-scenario.use-case';
import { AnalyzeWritingUseCase } from '../../application/writing/use-cases/analyze-writing.use-case';
import { GenerateWritingDto, SubmitWritingDto } from '../dtos/writing-activity.dto';

@ApiTags('writing-activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('writing-activity')
export class WritingController {
  constructor(
    private readonly generateScenario: GenerateScenarioUseCase,
    private readonly analyzeWriting: AnalyzeWritingUseCase,
    @InjectRepository(WritingActivityEntity)
    private readonly repo: Repository<WritingActivityEntity>,
  ) {}

  // ── POST /writing-activity/generate ──────────────────────────────────────
  @Post('generate')
  @ApiOperation({ summary: 'Generate a new writing scenario (inbox email + checklist).' })
  async generate(
    @Body() dto: GenerateWritingDto,
    @CurrentUser() user: UserEntity,
  ): Promise<WritingActivityEntity> {
    return this.generateScenario.execute(dto, user);
  }

  // ── GET /writing-activity/:id ─────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Fetch a previously generated writing activity.' })
  async getOne(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<WritingActivityEntity> {
    const activity = await this.repo.findOne({ where: { id } });
    if (!activity) throw new NotFoundException('Writing activity not found');
    if (activity.userId !== user.id) throw new ForbiddenException('Not your activity');
    return activity;
  }

  // ── POST /writing-activity/:id/analyze ───────────────────────────────────
  @Post(':id/analyze')
  @ApiOperation({
    summary:
      "Submit user's written reply, get AI correction (original vs improved) and earn tokens.",
  })
  async analyze(
    @Param('id') id: string,
    @Body() dto: SubmitWritingDto,
    @CurrentUser() user: UserEntity,
  ): Promise<WritingActivityEntity> {
    return this.analyzeWriting.execute(id, dto, user);
  }
}
