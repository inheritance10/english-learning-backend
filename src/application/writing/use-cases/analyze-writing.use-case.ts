import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeminiService } from '../../../infrastructure/gemini/gemini.service';
import { UserEntity } from '../../../domain/entities/user.entity';
import { WritingActivityEntity } from '../../../domain/entities/writing-activity.entity';

export interface AnalyzeWritingInput {
  userText: string;
}

/** Tokens awarded for completing a writing activity. */
const TOKENS_PER_WRITING = 15;

@Injectable()
export class AnalyzeWritingUseCase {
  private readonly logger = new Logger(AnalyzeWritingUseCase.name);

  constructor(
    private readonly gemini: GeminiService,
    @InjectRepository(WritingActivityEntity)
    private readonly repo: Repository<WritingActivityEntity>,
  ) {}

  async execute(
    activityId: string,
    input: AnalyzeWritingInput,
    user: UserEntity,
  ): Promise<WritingActivityEntity> {
    const activity = await this.repo.findOne({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('Writing activity not found');
    if (activity.userId !== user.id) throw new ForbiddenException('Not your activity');

    const language = (user.language ?? 'tr') as 'en' | 'tr';

    this.logger.log(
      `Analyzing writing for user=${user.id} activity=${activityId}`,
    );

    const analysis = await this.gemini.analyzeWriting({
      userText: input.userText,
      scenario: activity.scenario,
      receivedMail: activity.receivedMail,
      cefrLevel: activity.cefrLevel,
      language,
    });

    activity.userText = input.userText;
    activity.aiCorrection = {
      original: input.userText,
      improved: analysis.improved,
      proTip: analysis.proTip,
      highlightedPhrases: analysis.highlightedPhrases,
    };
    activity.isCompleted = true;
    activity.tokensEarned = TOKENS_PER_WRITING;
    activity.completedAt = new Date();

    return this.repo.save(activity);
  }
}
