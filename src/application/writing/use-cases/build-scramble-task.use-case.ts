import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { GeminiService } from '../../../infrastructure/gemini/gemini.service';
import { ScrambleSentenceEntity } from '../../../domain/entities/scramble-sentence.entity';
import type { ScrambleTask, WritingFocus } from '../../../domain/entities/writing-task.entity';
import { normalizeOrder, toScrambleRound } from '../scramble-words';

export const SCRAMBLE_ROUNDS = 6;
/** Sentences generated per AI call; one call fills two activities' worth of the pool. */
const GENERATE_BATCH = 12;
/** Existing sentences shown to the AI so it writes different ones. */
const AVOID_IN_PROMPT = 60;

export interface BuildScrambleTaskInput {
  userId: string;
  cefrLevel: string;
  interest: string;
  interestLabel: string;
  topicId: string | null;
  focus: WritingFocus | null;
  language: 'en' | 'tr';
}

/**
 * Picks word order sentences the learner has not seen yet from the shared pool.
 * The AI is only called when the pool runs out for this learner, and what it
 * generates is kept for every other learner with the same level, interest and topic.
 */
@Injectable()
export class BuildScrambleTaskUseCase {
  private readonly logger = new Logger(BuildScrambleTaskUseCase.name);

  constructor(
    private readonly gemini: GeminiService,
    @InjectRepository(ScrambleSentenceEntity)
    private readonly sentences: Repository<ScrambleSentenceEntity>,
  ) {}

  async execute(input: BuildScrambleTaskInput): Promise<ScrambleTask> {
    let unseen = await this.findUnseen(input);
    if (unseen.length < SCRAMBLE_ROUNDS) {
      try {
        await this.generate(input);
        unseen = await this.findUnseen(input);
      } catch (err: any) {
        this.logger.warn(`Word order generation failed: ${err?.message}`);
      }
    }

    let picked = unseen.slice(0, SCRAMBLE_ROUNDS);
    if (picked.length < SCRAMBLE_ROUNDS) {
      // AI unavailable or out of ideas: top up with the oldest sentences the learner has already seen
      const query = this.combo(input);
      if (picked.length) query.andWhere('s.id NOT IN (:...ids)', { ids: picked.map((s) => s.id) });
      const seen = await query
        .orderBy('s.created_at', 'ASC')
        .take(SCRAMBLE_ROUNDS - picked.length)
        .getMany();
      picked = [...picked, ...seen];
    }
    if (picked.length < SCRAMBLE_ROUNDS) {
      throw new ServiceUnavailableException({
        code: 'WRITING_UNAVAILABLE',
        message: 'Could not prepare a writing activity right now',
      });
    }

    // Shorter sentences first so each activity gets a little harder as it goes
    picked.sort((a, b) => a.words.length - b.words.length);
    return {
      mode: 'scramble',
      rounds: picked.map((s) => ({ id: s.id, sentence: s.sentence, hint: s.hint, words: s.words, end: s.end })),
    };
  }

  private combo(input: BuildScrambleTaskInput) {
    return this.sentences
      .createQueryBuilder('s')
      .where('s.cefr_level = :cefrLevel', { cefrLevel: input.cefrLevel })
      .andWhere('s.interest = :interest', { interest: input.interest })
      .andWhere('s.language = :language', { language: input.language })
      .andWhere(input.topicId ? 's.topic_id = :topicId' : 's.topic_id IS NULL', { topicId: input.topicId });
  }

  private findUnseen(input: BuildScrambleTaskInput): Promise<ScrambleSentenceEntity[]> {
    return this.combo(input)
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM writing_activities a, jsonb_array_elements(a.task -> 'rounds') r
          WHERE a.user_id = :userId AND a.activity_type = 'scramble' AND r ->> 'id' = s.id::text
        )`,
        { userId: input.userId },
      )
      .orderBy('RANDOM()')
      .take(SCRAMBLE_ROUNDS)
      .getMany();
  }

  private async generate(input: BuildScrambleTaskInput): Promise<void> {
    const existing = await this.sentences.find({
      where: {
        cefrLevel: input.cefrLevel,
        interest: input.interest,
        language: input.language,
        topicId: input.topicId ?? IsNull(),
      },
      select: { sentence: true, normalized: true },
      order: { createdAt: 'DESC' },
    });
    const known = new Set(existing.map((s) => s.normalized));

    this.logger.log(
      `Generating ${GENERATE_BATCH} word order sentences level=${input.cefrLevel} interest=${input.interest} topic=${input.focus?.name ?? '-'} pool=${existing.length}`,
    );
    const generated = await this.gemini.generateScrambleSentences({
      cefrLevel: input.cefrLevel,
      interestLabel: input.interestLabel,
      language: input.language,
      focus: input.focus ?? undefined,
      count: GENERATE_BATCH,
      avoid: existing.slice(0, AVOID_IN_PROMPT).map((s) => s.sentence),
    });

    const rows = [];
    for (const { sentence, hint } of generated) {
      const round = toScrambleRound(sentence, hint);
      const normalized = normalizeOrder(sentence);
      if (!round || known.has(normalized)) continue;
      known.add(normalized);
      rows.push(
        this.sentences.create({
          cefrLevel: input.cefrLevel,
          interest: input.interest,
          topicId: input.topicId,
          language: input.language,
          normalized,
          ...round,
        }),
      );
    }
    if (rows.length) await this.sentences.save(rows);
  }
}
