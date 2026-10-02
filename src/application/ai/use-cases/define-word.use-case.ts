import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeminiService } from '../../../infrastructure/gemini/gemini.service';
import { UserEntity } from '../../../domain/entities/user.entity';
import {
  WordDefinitionEntity,
  type WordDefinition,
} from '../../../domain/entities/word-definition.entity';

/** Translations are always Turkish, whatever the app UI language is. */
const TRANSLATION_LANGUAGE = 'tr';

export interface DefineWordInput {
  word: string;
  context?: string;
  cefrLevel?: string;
}

@Injectable()
export class DefineWordUseCase {
  private readonly logger = new Logger(DefineWordUseCase.name);

  constructor(
    private readonly gemini: GeminiService,
    @InjectRepository(WordDefinitionEntity)
    private readonly cache: Repository<WordDefinitionEntity>,
  ) {}

  async execute(input: DefineWordInput, user: UserEntity): Promise<WordDefinition> {
    const word = input.word.trim().toLowerCase();
    const cefrLevel = input.cefrLevel ?? user.cefrLevel ?? 'B1';

    const cached = await this.cache.findOne({ where: { word, cefrLevel, language: TRANSLATION_LANGUAGE } });
    if (cached?.definition?.meanings?.length) return cached.definition;

    if (!this.gemini.isConfigured) {
      return this.fallback(word, 'mock - API key not configured');
    }

    try {
      const definition = await this.gemini.defineWord({ word, cefrLevel });
      await this.cache
        .createQueryBuilder()
        .insert()
        .values({ word, cefrLevel, language: TRANSLATION_LANGUAGE, definition })
        .orUpdate(['definition'], ['word', 'cefr_level', 'language'])
        .execute();
      return definition;
    } catch (err: any) {
      this.logger.warn(`Definition failed for "${word}": ${err?.message}`);
      return this.fallback(word, 'could not load');
    }
  }

  private fallback(word: string, reason: string): WordDefinition {
    return {
      word,
      phonetic: '',
      partOfSpeech: 'word',
      definition: `Could not load definition for "${word}" (${reason})`,
      translation: '',
      exampleSentence: '',
      exampleTranslation: '',
    };
  }
}
