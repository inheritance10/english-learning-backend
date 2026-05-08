import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeminiService } from '../../../infrastructure/gemini/gemini.service';
import { UserEntity } from '../../../domain/entities/user.entity';
import {
  WritingActivityEntity,
  WritingActivityType,
} from '../../../domain/entities/writing-activity.entity';

export interface GenerateScenarioInput {
  interest: string;
  cefrLevel?: string;
  activityType?: WritingActivityType;
}

const INTEREST_LABEL: Record<string, { tr: string; en: string }> = {
  travel: { tr: 'Seyahat', en: 'Travel' },
  business: { tr: 'İş Dünyası', en: 'Business' },
  technology: { tr: 'Teknoloji', en: 'Technology' },
  popCulture: { tr: 'Pop Kültür', en: 'Pop Culture' },
  science: { tr: 'Bilim', en: 'Science' },
  everyday: { tr: 'Günlük Hayat', en: 'Everyday Life' },
};

@Injectable()
export class GenerateScenarioUseCase {
  private readonly logger = new Logger(GenerateScenarioUseCase.name);

  constructor(
    private readonly gemini: GeminiService,
    @InjectRepository(WritingActivityEntity)
    private readonly repo: Repository<WritingActivityEntity>,
  ) {}

  async execute(input: GenerateScenarioInput, user: UserEntity): Promise<WritingActivityEntity> {
    const cefrLevel = input.cefrLevel ?? user.cefrLevel ?? 'B1';
    const language = (user.language ?? 'tr') as 'en' | 'tr';
    const interest = input.interest || 'everyday';
    const interestLabel = INTEREST_LABEL[interest]?.[language] ?? interest;
    const activityType: WritingActivityType = input.activityType ?? 'mail';

    this.logger.log(
      `Generating writing scenario for user=${user.id} type=${activityType} interest=${interest} level=${cefrLevel}`,
    );

    const generated = await this.gemini.generateWritingScenario({
      cefrLevel,
      interest,
      interestLabel,
      language,
      activityType,
    });

    const entity = this.repo.create({
      userId: user.id,
      cefrLevel,
      interest,
      activityType,
      scenario: generated.scenario,
      receivedMail: generated.receivedMail,
      keyPoints: generated.keyPoints,
      initialHint: generated.initialHint,
      userText: null,
      aiCorrection: null,
      isCompleted: false,
      tokensEarned: 0,
      completedAt: null,
    });

    return this.repo.save(entity);
  }
}
