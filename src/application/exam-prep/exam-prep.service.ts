import { Injectable, Logger, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { ExamEntity } from '../../domain/entities/exam.entity';
import { ExamCategoryEntity } from '../../domain/entities/exam-category.entity';
import { QuestionEntity } from '../../domain/entities/question.entity';
import { UserExamAttemptEntity } from '../../domain/entities/user-exam-attempt.entity';
import { AiGeneratedVariantEntity } from '../../domain/entities/ai-generated-variant.entity';
import { UserEntity } from '../../domain/entities/user.entity';
import { VocabularyItemEntity, VocabularyStatus } from '../../domain/entities/vocabulary-item.entity';
import { GeminiService } from '../../infrastructure/gemini/gemini.service';
import { ImportQuestionDto } from './dto/import-question.dto';

@Injectable()
export class ExamPrepService {
  private readonly logger = new Logger(ExamPrepService.name);

  constructor(
    @InjectRepository(ExamEntity)
    private readonly examRepo: Repository<ExamEntity>,
    @InjectRepository(ExamCategoryEntity)
    private readonly categoryRepo: Repository<ExamCategoryEntity>,
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
    @InjectRepository(UserExamAttemptEntity)
    private readonly attemptRepo: Repository<UserExamAttemptEntity>,
    @InjectRepository(AiGeneratedVariantEntity)
    private readonly variantRepo: Repository<AiGeneratedVariantEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(VocabularyItemEntity)
    private readonly vocabRepo: Repository<VocabularyItemEntity>,
    private readonly geminiService: GeminiService,
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {}

  async getExams(): Promise<ExamEntity[]> {
    const cacheKey = 'exams:list';
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      this.logger.warn(`Redis get failed for ${cacheKey}: ${err.message}`);
    }

    const exams = await this.examRepo.find({
      where: { isActive: true },
      order: { orderIndex: 'ASC' },
    });

    try {
      await this.redis.setex(cacheKey, 600, JSON.stringify(exams));
    } catch (err) {
      this.logger.warn(`Redis setex failed for ${cacheKey}: ${err.message}`);
    }

    return exams;
  }

  async getCategories(examId: string): Promise<ExamCategoryEntity[]> {
    const cacheKey = `exam:${examId}:categories`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      this.logger.warn(`Redis get failed for ${cacheKey}: ${err.message}`);
    }

    const categories = await this.categoryRepo.find({
      where: { examId },
      order: { orderIndex: 'ASC' },
    });

    try {
      await this.redis.setex(cacheKey, 600, JSON.stringify(categories));
    } catch (err) {
      this.logger.warn(`Redis setex failed for ${cacheKey}: ${err.message}`);
    }

    return categories;
  }

  async getQuestions(
    examId: string,
    params: { categoryId?: string; page: number; limit: number },
  ): Promise<{ items: QuestionEntity[]; total: number; page: number; limit: number }> {
    const { categoryId, page, limit } = params;
    const cacheKey = `exam:${examId}:q:cat${categoryId || 'all'}:p${page}:l${limit}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      this.logger.warn(`Redis get failed for ${cacheKey}: ${err.message}`);
    }

    const qb = this.questionRepo
      .createQueryBuilder('q')
      .where('q.exam_id = :examId', { examId });

    if (categoryId) {
      qb.andWhere('q.category_id = :categoryId', { categoryId });
    }

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const result = { items, total, page, limit };

    try {
      await this.redis.setex(cacheKey, 300, JSON.stringify(result));
    } catch (err) {
      this.logger.warn(`Redis setex failed for ${cacheKey}: ${err.message}`);
    }

    return result;
  }

  async checkAnswer(
    user: UserEntity,
    questionId: string,
    selectedIndex: number,
    timeSpentMs: number,
  ): Promise<{
    correct: boolean;
    correctIndex: number;
    explanation: string | null;
    variant: { content: string; options: string[]; correctIndex: number; explanation: string | null } | null;
  }> {
    const question = await this.questionRepo.findOne({ where: { id: questionId } });
    if (!question) {
      throw new NotFoundException(`Question ${questionId} not found`);
    }

    const isCorrect = selectedIndex === question.correctIndex;

    const attempt = this.attemptRepo.create({
      userId: user.id,
      questionId,
      selectedIndex,
      isCorrect,
      timeSpentMs,
      topicTag: question.topicTag,
      examId: question.examId,
    });
    await this.attemptRepo.save(attempt);

    let variant: { content: string; options: string[]; correctIndex: number; explanation: string | null } | null = null;

    if (!isCorrect) {
      // Increment wrongCount
      await this.questionRepo.increment({ id: questionId }, 'wrongCount', 1);

      // Find or generate AI variant
      const existingVariant = await this.variantRepo.findOne({
        where: { originalQuestionId: questionId },
      });

      if (existingVariant) {
        variant = {
          content: existingVariant.content,
          options: existingVariant.options,
          correctIndex: existingVariant.correctIndex,
          explanation: existingVariant.explanation,
        };
      } else {
        try {
          const generated = await this.geminiService.generateQuestionVariant({
            content: question.content,
            options: question.options,
            correctIndex: question.correctIndex,
            explanation: question.explanation,
            difficultyLevel: question.difficultyLevel,
            topicTag: question.topicTag,
          });

          const saved = this.variantRepo.create({
            originalQuestionId: questionId,
            content: generated.content,
            options: generated.options,
            correctIndex: generated.correctIndex,
            explanation: generated.explanation,
          });
          await this.variantRepo.save(saved);

          variant = {
            content: generated.content,
            options: generated.options,
            correctIndex: generated.correctIndex,
            explanation: generated.explanation,
          };
        } catch (err) {
          this.logger.warn(`Failed to generate/save variant for question ${questionId}: ${err.message}`);
        }
      }

      // Extract keywords and save to vocabulary
      await this.saveKeywordsToVocabulary(user, question.content);
    }

    return {
      correct: isCorrect,
      correctIndex: question.correctIndex,
      explanation: question.explanation ?? null,
      variant,
    };
  }

  async getWeakPoints(
    userId: string,
  ): Promise<{ topicTag: string; wrongCount: number; totalAttempts: number }[]> {
    const rows = await this.attemptRepo
      .createQueryBuilder('a')
      .select('a.topic_tag', 'topicTag')
      .addSelect('COUNT(*)', 'wrongCount')
      .addSelect('COUNT(*)', 'totalAttempts')
      .where('a.user_id = :userId', { userId })
      .andWhere('a.topic_tag IS NOT NULL')
      .andWhere('a.is_correct = false')
      .groupBy('a.topic_tag')
      .orderBy('wrongCount', 'DESC')
      .limit(10)
      .getRawMany();

    return rows.map((r) => ({
      topicTag: r.topicTag,
      wrongCount: parseInt(r.wrongCount, 10),
      totalAttempts: parseInt(r.totalAttempts, 10),
    }));
  }

  async bulkImport(questions: ImportQuestionDto[]): Promise<{ imported: number }> {
    let imported = 0;

    for (const q of questions) {
      // Find or create exam
      let exam = await this.examRepo.findOne({ where: { name: q.examName } });
      if (!exam) {
        exam = this.examRepo.create({ name: q.examName, isActive: true });
        await this.examRepo.save(exam);
      }

      // Find or create category
      let category = await this.categoryRepo.findOne({
        where: { examId: exam.id, name: q.categoryName },
      });
      if (!category) {
        category = this.categoryRepo.create({
          examId: exam.id,
          name: q.categoryName,
        });
        await this.categoryRepo.save(category);
      }

      // Create question
      const question = this.questionRepo.create({
        examId: exam.id,
        categoryId: category.id,
        content: q.content,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        difficultyLevel: q.difficultyLevel ?? 'medium',
        topicTag: q.topicTag,
        isOriginal: q.isOriginal ?? true,
      });
      await this.questionRepo.save(question);

      // Update question count
      await this.categoryRepo.increment({ id: category.id }, 'questionCount', 1);

      imported++;
    }

    return { imported };
  }

  private async saveKeywordsToVocabulary(user: UserEntity, content: string): Promise<void> {
    try {
      const words = content
        .split(/\s+/)
        .map((w) => w.replace(/[^a-zA-Z]/g, '').toLowerCase())
        .filter((w) => w.length > 5);

      const unique = [...new Set(words)].slice(0, 3);

      for (const word of unique) {
        const existing = await this.vocabRepo.findOne({
          where: { word, userId: user.id },
        });
        if (!existing) {
          const item = this.vocabRepo.create({
            word,
            userId: user.id,
            status: VocabularyStatus.LEARNING,
          });
          await this.vocabRepo.save(item);
        }
      }
    } catch (err) {
      this.logger.warn(`saveKeywordsToVocabulary failed: ${err.message}`);
    }
  }
}
