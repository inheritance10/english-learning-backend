import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThanOrEqual, Repository } from 'typeorm';
import { GeminiService } from '../../../infrastructure/gemini/gemini.service';
import { UserEntity } from '../../../domain/entities/user.entity';
import { WritingActivityEntity } from '../../../domain/entities/writing-activity.entity';
import { TopicEntity } from '../../../domain/entities/topic.entity';
import {
  WritingFocus,
  WritingMode,
  WritingTask,
  WritingTaskEntity,
} from '../../../domain/entities/writing-task.entity';
import { interestLabel } from '../../../domain/constants/interests.constants';
import { GetWritingQuotaUseCase } from './get-writing-quota.use-case';

export interface StartWritingInput {
  mode: WritingMode;
  interest: string;
  cefrLevel?: string;
  topicId?: string;
}

export const CHAT_TURNS = 4;
export const STORY_TURNS = 3;

export function totalTurnsFor(task: WritingTask): number {
  if (task.mode === 'build' || task.mode === 'scramble') return task.rounds.length;
  if (task.mode === 'story') return STORY_TURNS;
  return CHAT_TURNS;
}

@Injectable()
export class StartWritingUseCase {
  private readonly logger = new Logger(StartWritingUseCase.name);

  constructor(
    private readonly gemini: GeminiService,
    private readonly getQuota: GetWritingQuotaUseCase,
    @InjectRepository(WritingActivityEntity)
    private readonly repo: Repository<WritingActivityEntity>,
    @InjectRepository(WritingTaskEntity)
    private readonly tasks: Repository<WritingTaskEntity>,
    @InjectRepository(TopicEntity)
    private readonly topics: Repository<TopicEntity>,
  ) {}

  async execute(input: StartWritingInput, user: UserEntity): Promise<WritingActivityEntity> {
    const { mode } = input;
    const cefrLevel = input.cefrLevel ?? user.cefrLevel ?? 'A2';
    const language = (user.language ?? 'tr') as 'en' | 'tr';
    const interest = input.interest || 'everyday';
    const topic = input.topicId ? await this.findTopic(input.topicId) : null;
    const topicId = topic?.id ?? null;

    // Resuming today's unfinished activity does not consume another daily slot.
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const unfinished = await this.repo.findOne({
      where: {
        userId: user.id,
        mode,
        interest,
        cefrLevel,
        topicId: topicId ?? IsNull(),
        isCompleted: false,
        createdAt: MoreThanOrEqual(startOfDay),
      },
      order: { createdAt: 'DESC' },
    });
    if (unfinished?.task) return unfinished;

    const quota = await this.getQuota.execute(user);
    if (!quota.unlimited && quota.remaining <= 0) {
      throw new ForbiddenException({
        code: 'DAILY_WRITING_LIMIT',
        message: 'Daily writing limit reached',
        limit: quota.limit,
      });
    }

    const focus: WritingFocus | null = topic
      ? { name: topic.name, example: topic.description || undefined }
      : null;
    const pooled =
      (await this.findUndoneTask(user.id, mode, cefrLevel, interest, topicId, language)) ??
      (await this.createTask(mode, cefrLevel, interest, topicId, focus, language));

    return this.repo.save(
      this.repo.create({
        userId: user.id,
        taskId: pooled.id,
        mode,
        cefrLevel,
        interest,
        topicId,
        topicName: topic ? (language === 'tr' && topic.titleTr) || topic.name : null,
        scenario: pooled.title,
        task: pooled.task,
        turns: [],
        totalTurns: totalTurnsFor(pooled.task),
      }),
    );
  }

  private async findTopic(topicId: string): Promise<TopicEntity> {
    const topic = await this.topics.findOne({ where: { id: topicId, isActive: true } });
    if (!topic) throw new NotFoundException('Topic not found');
    return topic;
  }

  private findUndoneTask(
    userId: string,
    mode: WritingMode,
    cefrLevel: string,
    interest: string,
    topicId: string | null,
    language: string,
  ): Promise<WritingTaskEntity | null> {
    return this.tasks
      .createQueryBuilder('t')
      .where('t.mode = :mode', { mode })
      .andWhere('t.cefr_level = :cefrLevel', { cefrLevel })
      .andWhere('t.interest = :interest', { interest })
      .andWhere(topicId ? 't.topic_id = :topicId' : 't.topic_id IS NULL', { topicId })
      .andWhere('t.language = :language', { language })
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM writing_activities a WHERE a.task_id = t.id AND a.user_id = :userId)',
        { userId },
      )
      .orderBy('RANDOM()')
      .getOne();
  }

  private async createTask(
    mode: WritingMode,
    cefrLevel: string,
    interest: string,
    topicId: string | null,
    focus: WritingFocus | null,
    language: 'en' | 'tr',
  ): Promise<WritingTaskEntity> {
    if (!this.gemini.isConfigured) {
      throw new ServiceUnavailableException({ code: 'WRITING_UNAVAILABLE', message: 'AI is not configured' });
    }
    const existing = await this.tasks.find({
      where: { mode, cefrLevel, interest, language, topicId: topicId ?? IsNull() },
      select: { title: true },
      order: { createdAt: 'DESC' },
      take: 30,
    });

    this.logger.log(
      `Generating writing task mode=${mode} level=${cefrLevel} interest=${interest} topic=${focus?.name ?? '-'}`,
    );
    try {
      const generated = await this.gemini.generateWritingTask({
        mode,
        cefrLevel,
        interestLabel: interestLabel(interest, language),
        language,
        focus: focus ?? undefined,
        avoidTitles: existing.map((t) => t.title),
      });
      return this.tasks.save(
        this.tasks.create({
          mode,
          cefrLevel,
          interest,
          language,
          topicId,
          title: generated.title,
          task: generated.task,
        }),
      );
    } catch {
      throw new ServiceUnavailableException({
        code: 'WRITING_UNAVAILABLE',
        message: 'Could not prepare a writing activity right now',
      });
    }
  }
}
