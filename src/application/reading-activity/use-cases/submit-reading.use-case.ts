import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../../domain/entities/user.entity';
import { ReadingActivityEntity } from '../../../domain/entities/reading-activity.entity';

export interface SubmitReadingInput {
  /** answers[i] = chosen option index for questions[i]; -1 = not answered */
  answers: number[];
}

export interface SubmitReadingResult {
  activityId: string;
  total: number;
  correct: number;
  score: number; // identical to correct (kept separate for future weighting)
  tokensEarned: number;
  results: Array<{
    questionId: string;
    chosenIndex: number;
    correctIndex: number;
    isCorrect: boolean;
    explanation?: string;
  }>;
}

/** Token reward per correct answer. */
const TOKEN_PER_CORRECT = 5;

@Injectable()
export class SubmitReadingUseCase {
  private readonly logger = new Logger(SubmitReadingUseCase.name);

  constructor(
    @InjectRepository(ReadingActivityEntity)
    private readonly repo: Repository<ReadingActivityEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async execute(
    activityId: string,
    input: SubmitReadingInput,
    user: UserEntity,
  ): Promise<SubmitReadingResult> {
    const activity = await this.repo.findOne({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('Reading activity not found');
    if (activity.userId !== user.id)
      throw new ForbiddenException('Activity does not belong to user');

    const { answers } = input;
    if (!Array.isArray(answers) || answers.length !== activity.questions.length) {
      throw new BadRequestException(
        `Expected ${activity.questions.length} answers, got ${answers?.length ?? 0}`,
      );
    }

    let correct = 0;
    const results = activity.questions.map((q, i) => {
      const chosen = answers[i];
      const isCorrect = chosen === q.correctIndex;
      if (isCorrect) correct += 1;
      return {
        questionId: q.id,
        chosenIndex: chosen,
        correctIndex: q.correctIndex,
        isCorrect,
        explanation: q.explanation,
      };
    });

    const tokensEarned = correct * TOKEN_PER_CORRECT;

    activity.score = correct;
    activity.tokensEarned = tokensEarned;
    activity.isCompleted = true;
    activity.completedAt = new Date();
    await this.repo.save(activity);

    // Award tokens to user balance (additive; never decrease here).
    if (tokensEarned > 0) {
      try {
        await this.userRepo
          .createQueryBuilder()
          .update(UserEntity)
          .set({ totalTokens: () => `total_tokens + ${tokensEarned}` })
          .where('id = :id', { id: user.id })
          .execute();
      } catch (err: any) {
        // Token award is non-blocking — log and continue.
        this.logger.warn(`Failed to award tokens for user ${user.id}: ${err?.message}`);
      }
    }

    return {
      activityId: activity.id,
      total: activity.questions.length,
      correct,
      score: correct,
      tokensEarned,
      results,
    };
  }
}
