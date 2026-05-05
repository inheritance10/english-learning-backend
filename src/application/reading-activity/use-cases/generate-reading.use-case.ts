import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { GeminiService } from '../../../infrastructure/gemini/gemini.service';
import { UserEntity } from '../../../domain/entities/user.entity';
import {
  ReadingActivityEntity,
  ReadingQuestion,
} from '../../../domain/entities/reading-activity.entity';

export interface GenerateReadingInput {
  /** Interest id e.g. 'technology' | 'travel' | 'business' */
  interest: string;
  /** Optional CEFR override; otherwise pulled from user. */
  cefrLevel?: string;
}

/**
 * Maps an interest id → display label in user's language.
 * Keep keys aligned with frontend `INTERESTS` ids in TopicSelectionScreen.
 */
const INTEREST_LABEL: Record<string, { tr: string; en: string }> = {
  travel: { tr: 'Seyahat', en: 'Travel' },
  business: { tr: 'İş Dünyası', en: 'Business' },
  technology: { tr: 'Teknoloji', en: 'Technology' },
  popCulture: { tr: 'Pop Kültür', en: 'Pop Culture' },
  science: { tr: 'Bilim', en: 'Science' },
  everyday: { tr: 'Günlük Hayat', en: 'Everyday Life' },
};

@Injectable()
export class GenerateReadingUseCase {
  private readonly logger = new Logger(GenerateReadingUseCase.name);

  constructor(
    private readonly gemini: GeminiService,
    @InjectRepository(ReadingActivityEntity)
    private readonly repo: Repository<ReadingActivityEntity>,
  ) {}

  async execute(
    input: GenerateReadingInput,
    user: UserEntity,
  ): Promise<ReadingActivityEntity> {
    const cefrLevel = input.cefrLevel ?? user.cefrLevel ?? 'A2';
    const language = (user.language ?? 'tr') as 'en' | 'tr';
    const interest = input.interest || 'everyday';
    const interestLabel =
      INTEREST_LABEL[interest]?.[language] ?? interest;

    this.logger.log(
      `Generating reading activity for user=${user.id} interest=${interest} level=${cefrLevel}`,
    );

    const generated = await this.gemini.generateReadingActivity({
      cefrLevel,
      interest,
      interestLabel,
      language,
    });

    // Attach stable ids to questions so the client can use them as keys.
    const questions: ReadingQuestion[] = generated.questions.map((q) => ({
      id: randomUUID(),
      type: q.type,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
    }));

    const entity = this.repo.create({
      userId: user.id,
      cefrLevel,
      interest,
      topicLabel: generated.topicLabel,
      title: generated.title,
      content: generated.content,
      highlightedWords: generated.highlightedWords,
      questions,
      isCompleted: false,
      score: 0,
      tokensEarned: 0,
    });

    return this.repo.save(entity);
  }
}
