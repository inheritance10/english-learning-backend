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
import { StartWritingUseCase } from '../../application/writing/use-cases/start-writing.use-case';
import { SubmitWritingTurnUseCase } from '../../application/writing/use-cases/submit-writing-turn.use-case';
import { GetWritingQuotaUseCase } from '../../application/writing/use-cases/get-writing-quota.use-case';
import { StartWritingDto, SubmitWritingTurnDto } from '../dtos/writing-activity.dto';

@ApiTags('writing-activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('writing-activity')
export class WritingController {
  constructor(
    private readonly startWriting: StartWritingUseCase,
    private readonly submitTurn: SubmitWritingTurnUseCase,
    private readonly getQuota: GetWritingQuotaUseCase,
    @InjectRepository(WritingActivityEntity)
    private readonly repo: Repository<WritingActivityEntity>,
  ) {}

  @Get('quota')
  @ApiOperation({ summary: "Today's writing allowance (free users get a daily limit)." })
  async quota(@CurrentUser() user: UserEntity) {
    return this.getQuota.execute(user);
  }

  @Post('start')
  @ApiOperation({ summary: 'Start (or resume) a writing activity for the given mode and interest.' })
  async start(@Body() dto: StartWritingDto, @CurrentUser() user: UserEntity) {
    return this.startWriting.execute(dto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a writing activity.' })
  async getOne(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    const activity = await this.repo.findOne({ where: { id } });
    if (!activity) throw new NotFoundException('Writing activity not found');
    if (activity.userId !== user.id) throw new ForbiddenException('Not your activity');
    return activity;
  }

  @Post(':id/turns')
  @ApiOperation({ summary: "Submit the learner's next sentence or message and get feedback." })
  async turn(
    @Param('id') id: string,
    @Body() dto: SubmitWritingTurnDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.submitTurn.execute(id, dto.text.trim(), user);
  }
}
