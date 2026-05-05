import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { QuestionEntity } from '../../domain/entities/question.entity';
import { AiGeneratedVariantEntity } from '../../domain/entities/ai-generated-variant.entity';
import { GeminiService } from '../../infrastructure/gemini/gemini.service';
import { EXAM_PREP_QUEUE } from './exam-prep.producer';

@Processor(EXAM_PREP_QUEUE, {
  concurrency: 2,
})
export class ExamPrepConsumer extends WorkerHost {
  private readonly logger = new Logger(ExamPrepConsumer.name);

  constructor(
    private readonly geminiService: GeminiService,
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
    @InjectRepository(AiGeneratedVariantEntity)
    private readonly variantRepo: Repository<AiGeneratedVariantEntity>,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'pre-generate-variants') {
      this.logger.warn(`Unknown job name: ${job.name}`);
      return;
    }

    this.logger.log('Starting pre-generate-variants job');

    // Get IDs of questions that already have a variant
    const existingVariants = await this.variantRepo
      .createQueryBuilder('v')
      .select('v.original_question_id', 'questionId')
      .getRawMany();

    const existingIds = existingVariants.map((v) => v.questionId);

    // Fetch top 20 questions by wrongCount that have no variant yet
    const qb = this.questionRepo
      .createQueryBuilder('q')
      .orderBy('q.wrong_count', 'DESC')
      .limit(20);

    if (existingIds.length > 0) {
      qb.where('q.id NOT IN (:...existingIds)', { existingIds });
    }

    const questions = await qb.getMany();

    this.logger.log(`Found ${questions.length} questions without variants to pre-generate`);

    for (const question of questions) {
      try {
        const generated = await this.geminiService.generateQuestionVariant({
          content: question.content,
          options: question.options,
          correctIndex: question.correctIndex,
          explanation: question.explanation,
          difficultyLevel: question.difficultyLevel,
          topicTag: question.topicTag,
        });

        const variant = this.variantRepo.create({
          originalQuestionId: question.id,
          content: generated.content,
          options: generated.options,
          correctIndex: generated.correctIndex,
          explanation: generated.explanation,
        });
        await this.variantRepo.save(variant);

        this.logger.debug(`Pre-generated variant for question ${question.id}`);
      } catch (err) {
        this.logger.error(
          `Failed to pre-generate variant for question ${question.id}: ${err.message}`,
        );
      }
    }

    this.logger.log('pre-generate-variants job completed');
  }
}
