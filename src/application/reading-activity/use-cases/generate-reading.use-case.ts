import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { GeminiService } from '../../../infrastructure/gemini/gemini.service';
import { UserEntity } from '../../../domain/entities/user.entity';
import {
  ReadingActivityEntity,
  ReadingQuestion,
} from '../../../domain/entities/reading-activity.entity';
import { ReadingPassageEntity } from '../../../domain/entities/reading-passage.entity';
import { GetReadingQuotaUseCase } from './get-reading-quota.use-case';
import { interestLabel as labelFor } from '../../../domain/constants/interests.constants';

export interface GenerateReadingInput {
  /** Interest id e.g. 'technology' | 'travel' | 'business' */
  interest: string;
  /** Optional CEFR override; otherwise pulled from user. */
  cefrLevel?: string;
}

@Injectable()
export class GenerateReadingUseCase {
  private readonly logger = new Logger(GenerateReadingUseCase.name);

  constructor(
    private readonly gemini: GeminiService,
    private readonly getQuota: GetReadingQuotaUseCase,
    @InjectRepository(ReadingActivityEntity)
    private readonly repo: Repository<ReadingActivityEntity>,
    @InjectRepository(ReadingPassageEntity)
    private readonly passages: Repository<ReadingPassageEntity>,
  ) {}

  async execute(input: GenerateReadingInput, user: UserEntity): Promise<ReadingActivityEntity> {
    const cefrLevel = input.cefrLevel ?? user.cefrLevel ?? 'A2';
    const language = (user.language ?? 'tr') as 'en' | 'tr';
    const interest = input.interest || 'everyday';

    // Resuming today's unfinished reading does not consume another daily slot.
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const unfinished = await this.repo.findOne({
      where: {
        userId: user.id,
        interest,
        cefrLevel,
        isCompleted: false,
        createdAt: MoreThanOrEqual(startOfDay),
      },
      order: { createdAt: 'DESC' },
    });
    if (unfinished) return unfinished;

    const quota = await this.getQuota.execute(user);
    if (!quota.unlimited && quota.remaining <= 0) {
      throw new ForbiddenException({
        code: 'DAILY_READING_LIMIT',
        message: 'Daily reading limit reached',
        limit: quota.limit,
      });
    }

    const passage =
      (await this.findUnreadPassage(user.id, cefrLevel, interest, language)) ??
      (await this.createPassage(cefrLevel, interest, language));

    const activity = this.repo.create({
      userId: user.id,
      passageId: passage.id ?? null,
      cefrLevel,
      interest,
      topicLabel: passage.topicLabel,
      title: passage.title,
      content: passage.content,
      highlightedWords: passage.highlightedWords,
      questions: passage.questions,
      isCompleted: false,
      score: 0,
      tokensEarned: 0,
    });
    return this.repo.save(activity);
  }

  private findUnreadPassage(
    userId: string,
    cefrLevel: string,
    interest: string,
    language: string,
  ): Promise<ReadingPassageEntity | null> {
    return this.passages
      .createQueryBuilder('p')
      .where('p.cefr_level = :cefrLevel', { cefrLevel })
      .andWhere('p.interest = :interest', { interest })
      .andWhere('p.language = :language', { language })
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM reading_activities a WHERE a.passage_id = p.id AND a.user_id = :userId)',
        { userId },
      )
      .orderBy('RANDOM()')
      .getOne();
  }

  /** Generates a new passage; it joins the shared pool unless it is mock data. */
  private async createPassage(
    cefrLevel: string,
    interest: string,
    language: 'en' | 'tr',
  ): Promise<Partial<ReadingPassageEntity>> {
    const interestLabel = labelFor(interest, language);
    this.logger.log(`Generating new passage level=${cefrLevel} interest=${interest} lang=${language}`);

    const existing = await this.passages.find({
      where: { cefrLevel, interest, language },
      select: { title: true },
      order: { createdAt: 'DESC' },
      take: 30,
    });

    let generated: Awaited<ReturnType<GeminiService['generateReadingActivity']>>;
    try {
      generated = await this.gemini.generateReadingActivity({
        cefrLevel,
        interest,
        interestLabel,
        language,
        avoidTitles: existing.map((p) => p.title),
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'READING_GENERATION_FAILED',
        message: 'Could not generate a reading right now',
      });
    }

    const questions: ReadingQuestion[] = generated.questions.map((q) => ({
      id: randomUUID(),
      ...q,
    }));
    const data = {
      cefrLevel,
      interest,
      language,
      topicLabel: generated.topicLabel,
      title: generated.title,
      content: generated.content,
      highlightedWords: generated.highlightedWords,
      questions,
    };

    if (!this.gemini.isConfigured) return data;
    return this.passages.save(this.passages.create(data));
  }
}
