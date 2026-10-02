import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeminiService } from '../../infrastructure/gemini/gemini.service';
import { QuizQuestionEntity, QuestionType } from '../../domain/entities/quiz-question.entity';
import { TopicEntity } from '../../domain/entities/topic.entity';

const BATCH_SIZE = 15;
/** Existing questions shown to Gemini as "don't repeat" examples. */
const AVOID_SAMPLE = 40;

const normalize = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9_]+/g, ' ').replace(/\s+/g, ' ').trim();

@Injectable()
export class QuestionPoolStore {
  private readonly logger = new Logger(QuestionPoolStore.name);

  constructor(
    private readonly gemini: GeminiService,
    @InjectRepository(QuizQuestionEntity)
    private readonly questionRepo: Repository<QuizQuestionEntity>,
  ) {}

  countReady(topicId: string): Promise<number> {
    return this.questionRepo.count({ where: { topicId, poolReady: true } });
  }

  /** Generates up to `amount` new, non-duplicate questions for the topic and saves them to the pool. */
  async generateForTopic(topic: TopicEntity, amount: number, interests: string[] = []): Promise<QuizQuestionEntity[]> {
    const existing = await this.questionRepo.find({ where: { topicId: topic.id }, select: ['questionText'] });
    const known = new Set(existing.map((q) => normalize(q.questionText)));
    const recent = existing.map((q) => q.questionText);

    const saved: QuizQuestionEntity[] = [];
    // Extra attempts absorb batches that come back mostly as duplicates
    const maxAttempts = Math.ceil(amount / BATCH_SIZE) + 2;

    for (let attempt = 0; attempt < maxAttempts && saved.length < amount; attempt++) {
      const count = Math.min(BATCH_SIZE, amount - saved.length);
      const avoid = [...recent].sort(() => Math.random() - 0.5).slice(0, AVOID_SAMPLE);

      const generated = await this.gemini.generatePoolQuestions({
        topic: topic.name,
        example: topic.description,
        cefrLevel: topic.cefrLevel,
        count,
        avoid,
        interests,
      });

      const fresh = generated.filter((q) => {
        const key = normalize(q.question);
        if (known.has(key)) return false;
        known.add(key);
        return true;
      });
      if (fresh.length < generated.length) {
        this.logger.log(`Skipped ${generated.length - fresh.length} duplicate questions for "${topic.name}".`);
      }

      const entities = fresh.slice(0, amount - saved.length).map((q) =>
        this.questionRepo.create({
          topicId: topic.id,
          cefrLevel: topic.cefrLevel,
          language: 'en',
          type: QuestionType.MULTIPLE_CHOICE,
          questionText: q.question,
          options: q.options,
          correctAnswer: q.options[q.correctIndex],
          correctIndex: q.correctIndex,
          explanationEn: q.explanationEn,
          explanationTr: q.explanationTr,
          hint: q.hint,
          grammarPoint: q.grammarPoint,
          isAiGenerated: true,
          poolReady: true,
          usageCount: 0,
        }),
      );
      saved.push(...(await this.questionRepo.save(entities)));
      recent.push(...fresh.map((q) => q.question));
    }

    this.logger.log(`Saved ${saved.length}/${amount} questions for "${topic.name}" (${topic.cefrLevel}).`);
    return saved;
  }
}
