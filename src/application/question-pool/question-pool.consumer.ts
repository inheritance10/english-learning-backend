import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { GeminiService } from '../../infrastructure/gemini/gemini.service';
import { QuizQuestionEntity, QuestionType } from '../../domain/entities/quiz-question.entity';
import {
  QUESTION_POOL_QUEUE,
  type FillTopicPoolJobData,
} from './question-pool.producer';

/**
 * Bir batch'te en fazla üretilecek soru sayısı.
 * Dev ortamında 5 → token tasarrufu; production'da 15.
 */
const MAX_BATCH = process.env.NODE_ENV === 'production' ? 15 : 5;

/**
 * Soru havuzu doldurma consumer'ı.
 *
 * İşlem akışı:
 * 1. Job'dan topicId, cefrLevel, hedef soru sayısını al
 * 2. Gemini'ye istenen kadar soru üret (max MAX_BATCH)
 * 3. quiz_questions tablosuna kaydet, poolReady = true yap
 *
 * concurrency: 1 → Gemini API rate limit'ini aşmamak için sıralı işlem.
 */
@Processor(QUESTION_POOL_QUEUE, { concurrency: 1 })
export class QuestionPoolConsumer extends WorkerHost {
  private readonly logger = new Logger(QuestionPoolConsumer.name);

  constructor(
    private readonly gemini: GeminiService,
    @InjectRepository(QuizQuestionEntity)
    private readonly questionRepo: Repository<QuizQuestionEntity>,
  ) {
    super();
  }

  async process(job: Job<FillTopicPoolJobData>): Promise<void> {
    const { topicId, topicName, cefrLevel, currentCount, targetCount, language } = job.data;

    const needed = Math.min(targetCount - currentCount, MAX_BATCH);
    if (needed <= 0) {
      this.logger.log(`Pool already full for topic="${topicName}" (${cefrLevel}), skipping.`);
      return;
    }

    this.logger.log(
      `Filling pool: topic="${topicName}" (${cefrLevel}), generating ${needed} questions…`,
    );

    let questions: Awaited<ReturnType<typeof this.gemini.generateQuizQuestions>>;
    try {
      questions = await this.gemini.generateQuizQuestions({
        topic: topicName,
        cefrLevel,
        interests: [],      // havuz soruları genel — interest yok
        count: needed,
        language,
      });
    } catch (err: any) {
      this.logger.error(
        `Gemini failed for topic="${topicName}": ${err?.message}`,
        err?.stack,
      );
      throw err; // BullMQ'nun retry mekanizması devreye girsin
    }

    if (!questions || questions.length === 0) {
      this.logger.warn(`No questions returned for topic="${topicName}" (${cefrLevel}).`);
      return;
    }

    // Soruları entity'ye map et ve toplu kaydet
    const entities = questions.map((q) => {
      const correctText = q.options[q.correctIndex] ?? q.options[0];
      return this.questionRepo.create({
        topicId,
        cefrLevel,
        language,
        type: QuestionType.MULTIPLE_CHOICE,
        questionText: q.question,
        options: q.options,
        correctAnswer: correctText,
        correctIndex: q.correctIndex,
        explanationEn: language === 'en' ? q.explanation : null,
        explanationTr: language === 'tr' ? q.explanation : null,
        hint: q.hint,
        grammarPoint: q.grammar_point,
        isAiGenerated: true,
        poolReady: true,        // hazır — havuzdan servis edilebilir
        usageCount: 0,
      });
    });

    await this.questionRepo.save(entities);

    this.logger.log(
      `✅ Saved ${entities.length} questions for topic="${topicName}" (${cefrLevel}).`,
    );
  }
}
