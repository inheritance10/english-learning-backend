import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeminiService } from '../../../infrastructure/gemini/gemini.service';
import { UserEntity } from '../../../domain/entities/user.entity';
import {
  WritingActivityEntity,
  WritingTurn,
} from '../../../domain/entities/writing-activity.entity';
import type { ScrambleTask, WritingMode, WritingTask } from '../../../domain/entities/writing-task.entity';
import { UpdateStreakUseCase } from '../../progress/use-cases/update-streak.use-case';
import { normalizeOrder } from '../scramble-words';

/** Tokens awarded per turn the learner gets right. */
const TOKENS_PER_GOOD_TURN: Partial<Record<WritingMode, number>> = { scramble: 2 };
const DEFAULT_TOKENS_PER_GOOD_TURN = 4;


/** Word order game: the answer is right when the words are in the sentence's order. */
function checkScramble(task: ScrambleTask, round: number, text: string): Omit<WritingTurn, 'userText'> {
  const { sentence, words } = task.rounds[round];
  return {
    ok: normalizeOrder(text) === normalizeOrder(words.join(' ')),
    corrected: sentence,
    corrections: [],
  };
}

export interface SubmitWritingTurnResult {
  turn: WritingTurn;
  turnIndex: number;
  isFinished: boolean;
  score: number;
  totalTurns: number;
  tokensEarned: number;
}

@Injectable()
export class SubmitWritingTurnUseCase {
  private readonly logger = new Logger(SubmitWritingTurnUseCase.name);

  constructor(
    private readonly gemini: GeminiService,
    @InjectRepository(WritingActivityEntity)
    private readonly repo: Repository<WritingActivityEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly updateStreak: UpdateStreakUseCase,
  ) {}

  async execute(activityId: string, text: string, user: UserEntity): Promise<SubmitWritingTurnResult> {
    const activity = await this.repo.findOne({ where: { id: activityId } });
    if (!activity) throw new NotFoundException('Writing activity not found');
    if (activity.userId !== user.id) throw new ForbiddenException('Not your activity');
    if (!activity.task || activity.isCompleted) {
      throw new BadRequestException('This activity is already finished');
    }

    const turnIndex = activity.turns.length;
    const isLastTurn = turnIndex === activity.totalTurns - 1;

    const evaluation =
      activity.task.mode === 'scramble'
        ? checkScramble(activity.task, turnIndex, text)
        : await this.evaluateWithAi(activity.task, activity, turnIndex, isLastTurn, text, user);

    const turn: WritingTurn = { userText: text, ...evaluation };
    activity.turns = [...activity.turns, turn];
    activity.score = activity.turns.filter((t) => t.ok).length;

    if (isLastTurn) {
      activity.isCompleted = true;
      activity.completedAt = new Date();
      activity.tokensEarned =
        activity.score * (TOKENS_PER_GOOD_TURN[activity.mode] ?? DEFAULT_TOKENS_PER_GOOD_TURN);
    }
    await this.repo.save(activity);

    if (isLastTurn) {
      if (activity.tokensEarned > 0) {
        try {
          await this.userRepo
            .createQueryBuilder()
            .update(UserEntity)
            .set({ totalTokens: () => `"totalTokens" + ${activity.tokensEarned}` })
            .where('id = :id', { id: user.id })
            .execute();
        } catch (err: any) {
          this.logger.warn(`Failed to award writing tokens for user ${user.id}: ${err?.message}`);
        }
      }
      // Update streak (non-blocking)
      this.updateStreak.recordActivity(user.id).catch(() => undefined);
    }

    return {
      turn,
      turnIndex,
      isFinished: isLastTurn,
      score: activity.score,
      totalTurns: activity.totalTurns,
      tokensEarned: activity.tokensEarned,
    };
  }

  private async evaluateWithAi(
    task: Exclude<WritingTask, ScrambleTask>,
    activity: WritingActivityEntity,
    turnIndex: number,
    isLastTurn: boolean,
    text: string,
    user: UserEntity,
  ): Promise<Omit<WritingTurn, 'userText'>> {
    try {
      return await this.gemini.evaluateWritingTurn({
        task,
        round: turnIndex,
        isLastTurn,
        history: activity.turns,
        userText: text,
        cefrLevel: activity.cefrLevel,
        focus: activity.topicName ?? undefined,
        language: (user.language ?? 'tr') as 'en' | 'tr',
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'WRITING_UNAVAILABLE',
        message: 'Could not check your writing right now',
      });
    }
  }
}
