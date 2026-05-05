import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '../../../infrastructure/gemini/gemini.service';
import { UserEntity } from '../../../domain/entities/user.entity';

export interface DefineWordInput {
  word: string;
  context?: string;
  cefrLevel?: string;
}

export interface WordDefinition {
  word: string;
  phonetic?: string;
  partOfSpeech: string;
  definition: string;
  translation: string;
  exampleSentence: string;
  exampleTranslation: string;
}

@Injectable()
export class DefineWordUseCase {
  private readonly logger = new Logger(DefineWordUseCase.name);

  constructor(private readonly gemini: GeminiService) {}

  async execute(input: DefineWordInput, user: UserEntity): Promise<WordDefinition> {
    const { word, context, cefrLevel } = input;
    const level = cefrLevel ?? user.cefrLevel ?? 'B1';
    const language = (user.language ?? 'tr') as 'en' | 'tr';

    return this.gemini.defineWord({ word, context, cefrLevel: level, language });
  }
}
