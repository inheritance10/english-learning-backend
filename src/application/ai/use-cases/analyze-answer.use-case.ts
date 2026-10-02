import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeminiService } from '../../../infrastructure/gemini/gemini.service';
import { UserEntity } from '../../../domain/entities/user.entity';
import { QuizQuestionEntity } from '../../../domain/entities/quiz-question.entity';
import {
  QuizAnswerExplanationEntity,
  type AnswerExplanation,
} from '../../../domain/entities/quiz-answer-explanation.entity';

export interface AnalyzeAnswerDto {
  question: string;
  correctAnswer: string;
  userAnswer: string;
  topicId: string;
  questionId?: string;
  chosenIndex?: number;
}

/** Response shape kept compatible with the app's AnswerAnalysis type. */
export interface AnswerAnalysisResult extends AnswerExplanation {
  isCorrect: boolean;
  socraticQuestions: string[];
  xpEarned: number;
}

/**
 * Explains a wrong quiz answer. For pool questions the explanation of each
 * (question, chosen option, language) is generated once and shared by all users.
 */
@Injectable()
export class AnalyzeAnswerUseCase {
  private readonly logger = new Logger(AnalyzeAnswerUseCase.name);

  constructor(
    private readonly gemini: GeminiService,
    @InjectRepository(QuizQuestionEntity)
    private readonly questionRepo: Repository<QuizQuestionEntity>,
    @InjectRepository(QuizAnswerExplanationEntity)
    private readonly explanationRepo: Repository<QuizAnswerExplanationEntity>,
  ) {}

  async execute(dto: AnalyzeAnswerDto, user: UserEntity): Promise<AnswerAnalysisResult> {
    const language = (user.language === 'en' ? 'en' : 'tr') as 'en' | 'tr';
    const cefrLevel = user.cefrLevel ?? 'B1';

    const question =
      dto.questionId && dto.chosenIndex !== undefined
        ? await this.questionRepo.findOne({ where: { id: dto.questionId } })
        : null;

    // Not a pool question (or unknown id): explain without caching
    if (!question || dto.chosenIndex === undefined || !question.options[dto.chosenIndex]) {
      const explanation = await this.gemini.explainWrongAnswer({
        question: dto.question,
        options: [],
        correctAnswer: dto.correctAnswer,
        userAnswer: dto.userAnswer,
        cefrLevel,
        language,
      });
      return this.toResult(explanation);
    }

    const key = { questionId: question.id, chosenIndex: dto.chosenIndex, language };
    const cached = await this.explanationRepo.findOne({ where: key });
    if (cached) return this.toResult(cached.explanation);

    // Use stored question data, not client-sent text, so the cache can't be poisoned
    const explanation = await this.gemini.explainWrongAnswer({
      question: question.questionText,
      options: question.options,
      correctAnswer: question.options[question.correctIndex ?? 0],
      userAnswer: question.options[dto.chosenIndex],
      cefrLevel: question.cefrLevel ?? cefrLevel,
      language,
    });

    await this.explanationRepo
      .createQueryBuilder()
      .insert()
      .values({ ...key, explanation })
      .orIgnore()
      .execute();
    this.logger.log(`Stored explanation for question ${question.id} option ${dto.chosenIndex} (${language}).`);

    return this.toResult(explanation);
  }

  private toResult(e: AnswerExplanation): AnswerAnalysisResult {
    return { isCorrect: false, feedback: e.feedback, rule: e.rule, example: e.example, socraticQuestions: [], xpEarned: 0 };
  }
}
