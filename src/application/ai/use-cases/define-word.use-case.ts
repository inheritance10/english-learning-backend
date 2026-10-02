import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { GeminiService } from '../../../infrastructure/gemini/gemini.service';
import { UserEntity } from '../../../domain/entities/user.entity';
import {
  WordDefinitionEntity,
  type WordDefinition,
} from '../../../domain/entities/word-definition.entity';

/** Translations are always Turkish, whatever the app UI language is. */
const TRANSLATION_LANGUAGE = 'tr';

const IRREGULAR: Record<string, string> = {
  am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be', being: 'be',
  has: 'have', had: 'have', does: 'do', did: 'do', done: 'do',
  went: 'go', gone: 'go', goes: 'go', saw: 'see', seen: 'see', ate: 'eat', eaten: 'eat',
  made: 'make', said: 'say', took: 'take', taken: 'take', came: 'come', got: 'get', gotten: 'get',
  knew: 'know', known: 'know', thought: 'think', told: 'tell', gave: 'give', given: 'give',
  found: 'find', left: 'leave', felt: 'feel', kept: 'keep', began: 'begin', begun: 'begin',
  brought: 'bring', bought: 'buy', wrote: 'write', written: 'write', ran: 'run', sat: 'sit',
  stood: 'stand', spoke: 'speak', spoken: 'speak', met: 'meet', paid: 'pay', sent: 'send',
  built: 'build', spent: 'spend', taught: 'teach', caught: 'catch', fell: 'fall', fallen: 'fall',
  won: 'win', lost: 'lose', drove: 'drive', driven: 'drive', flew: 'fly', flown: 'fly',
  slept: 'sleep', woke: 'wake', wore: 'wear', worn: 'wear', chose: 'choose', chosen: 'choose',
  broke: 'break', broken: 'break', forgot: 'forget', forgotten: 'forget', heard: 'hear',
  held: 'hold', led: 'lead', meant: 'mean', read: 'read', understood: 'understand',
  children: 'child', men: 'man', women: 'woman', people: 'person', feet: 'foot', teeth: 'tooth',
  mice: 'mouse', better: 'good', best: 'good', worse: 'bad', worst: 'bad',
};

/** Possible dictionary forms of an inflected word, most likely first. */
function baseFormCandidates(word: string): string[] {
  const out: string[] = [];
  const add = (w: string) => w.length > 1 && w !== word && !out.includes(w) && out.push(w);
  if (IRREGULAR[word]) add(IRREGULAR[word]);
  if (word.endsWith("'s")) add(word.slice(0, -2));

  const undouble = (stem: string) => (/([b-df-hj-np-tv-z])\1$/.test(stem) ? stem.slice(0, -1) : null);
  if (word.endsWith('ies')) add(word.slice(0, -3) + 'y');
  if (word.endsWith('ied')) add(word.slice(0, -3) + 'y');
  if (word.endsWith('ier')) add(word.slice(0, -3) + 'y');
  if (word.endsWith('iest')) add(word.slice(0, -4) + 'y');
  if (word.endsWith('ing')) {
    const stem = word.slice(0, -3);
    add(undouble(stem) ?? stem);
    add(stem + 'e');
    add(stem);
  }
  if (word.endsWith('ed')) {
    const stem = word.slice(0, -2);
    add(undouble(stem) ?? stem);
    add(word.slice(0, -1));
    add(stem);
  }
  if (word.endsWith('est')) {
    const stem = word.slice(0, -3);
    add(undouble(stem) ?? stem);
    add(word.slice(0, -2));
  }
  if (word.endsWith('er')) {
    const stem = word.slice(0, -2);
    add(undouble(stem) ?? stem);
    add(word.slice(0, -1));
  }
  if (word.endsWith('es')) add(word.slice(0, -2));
  if (word.endsWith('s') && !word.endsWith('ss')) add(word.slice(0, -1));
  return out;
}

export interface DefineWordInput {
  word: string;
  context?: string;
  cefrLevel?: string;
}

/**
 * Dictionary lookup: the DB is checked first (any level, then base forms like went → go),
 * and AI is only called for words nobody has looked up before. The AI result is stored,
 * so every later tap — by any user — is served from the DB.
 */
@Injectable()
export class DefineWordUseCase {
  private readonly logger = new Logger(DefineWordUseCase.name);
  /** Concurrent taps on the same new word share one AI call. */
  private readonly inFlight = new Map<string, Promise<WordDefinition>>();

  constructor(
    private readonly gemini: GeminiService,
    @InjectRepository(WordDefinitionEntity)
    private readonly cache: Repository<WordDefinitionEntity>,
  ) {}

  async execute(input: DefineWordInput, user: UserEntity): Promise<WordDefinition> {
    const word = input.word.trim().toLowerCase().replace(/’/g, "'").replace(/^[^a-z]+|[^a-z]+$/g, '');
    const cefrLevel = input.cefrLevel ?? user.cefrLevel ?? 'B1';
    if (!word) return this.fallback(input.word, 'empty word');

    const stored = await this.findStored(word, cefrLevel);
    if (stored) return stored;

    if (!this.gemini.isConfigured) return this.fallback(word, 'mock - API key not configured');

    const pending = this.inFlight.get(word);
    if (pending) return pending;

    const request = this.generateAndStore(word, cefrLevel).finally(() => this.inFlight.delete(word));
    this.inFlight.set(word, request);
    try {
      return await request;
    } catch (err: any) {
      this.logger.warn(`Definition failed for "${word}": ${err?.message}`);
      return this.fallback(word, 'could not load');
    }
  }

  /** Exact word beats base form; within those, the user's level, then the richest entry. */
  private async findStored(word: string, cefrLevel: string): Promise<WordDefinition | null> {
    const candidates = [word, ...baseFormCandidates(word)];
    const rows = await this.cache.find({
      where: { word: In(candidates), language: TRANSLATION_LANGUAGE },
    });
    const usable = rows.filter((r) => r.definition?.meanings?.length);
    if (usable.length === 0) return null;

    usable.sort(
      (a, b) =>
        candidates.indexOf(a.word) - candidates.indexOf(b.word) ||
        Number(b.cefrLevel === cefrLevel) - Number(a.cefrLevel === cefrLevel) ||
        (b.definition.meanings?.length ?? 0) - (a.definition.meanings?.length ?? 0),
    );
    return usable[0].definition;
  }

  private async generateAndStore(word: string, cefrLevel: string): Promise<WordDefinition> {
    const definition = await this.gemini.defineWord({ word, cefrLevel });
    await this.cache
      .createQueryBuilder()
      .insert()
      .values({ word, cefrLevel, language: TRANSLATION_LANGUAGE, definition })
      .orUpdate(['definition'], ['word', 'cefr_level', 'language'])
      .execute();
    this.logger.log(`Stored new definition for "${word}" (${cefrLevel}).`);
    return definition;
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
