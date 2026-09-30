import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReadingActivityEntity } from '../../../domain/entities/reading-activity.entity';
import { WritingActivityEntity } from '../../../domain/entities/writing-activity.entity';
import { UserEntity } from '../../../domain/entities/user.entity';

export type ActivityType = 'all' | 'reading' | 'writing';

export interface ActivityHistoryItem {
  id: string;
  type: 'reading' | 'writing';
  title: string;
  cefrLevel: string;
  interest: string;
  tokensEarned: number;
  /** For reading: percentage 0-100. null for writing. */
  scorePercent: number | null;
  /** For reading: correct / total e.g. "3/4" */
  scoreLabel: string | null;
  completedAt: string;
}

export interface ActivityHistoryResult {
  items: ActivityHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

const PAGE_SIZE = 15;

@Injectable()
export class GetActivityHistoryUseCase {
  constructor(
    @InjectRepository(ReadingActivityEntity)
    private readonly readingRepo: Repository<ReadingActivityEntity>,
    @InjectRepository(WritingActivityEntity)
    private readonly writingRepo: Repository<WritingActivityEntity>,
  ) {}

  async execute(
    user: UserEntity,
    type: ActivityType = 'all',
    page = 1,
  ): Promise<ActivityHistoryResult> {
    const offset = (page - 1) * PAGE_SIZE;

    const [readings, writings] = await Promise.all([
      type !== 'writing'
        ? this.readingRepo.find({ where: { userId: user.id, isCompleted: true }, order: { completedAt: 'DESC' } })
        : Promise.resolve([] as ReadingActivityEntity[]),
      type !== 'reading'
        ? this.writingRepo.find({ where: { userId: user.id, isCompleted: true }, order: { completedAt: 'DESC' } })
        : Promise.resolve([] as WritingActivityEntity[]),
    ]);

    const readingItems: ActivityHistoryItem[] = readings.map(r => {
      const total = r.questions?.length ?? 0;
      const scorePercent = total > 0 ? Math.round((r.score / total) * 100) : null;
      return {
        id: r.id,
        type: 'reading',
        title: r.title,
        cefrLevel: r.cefrLevel,
        interest: r.interest,
        tokensEarned: r.tokensEarned ?? 0,
        scorePercent,
        scoreLabel: total > 0 ? `${r.score}/${total}` : null,
        completedAt: r.completedAt?.toISOString() ?? '',
      };
    });

    const writingItems: ActivityHistoryItem[] = writings.map(w => ({
      id: w.id,
      type: 'writing',
      title: w.scenario?.slice(0, 70) + (w.scenario?.length > 70 ? '…' : ''),
      cefrLevel: w.cefrLevel,
      interest: w.interest,
      tokensEarned: w.tokensEarned ?? 0,
      scorePercent: null,
      scoreLabel: null,
      completedAt: w.completedAt?.toISOString() ?? '',
    }));

    const all = [...readingItems, ...writingItems].sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    );

    const total = all.length;
    const items = all.slice(offset, offset + PAGE_SIZE);

    return {
      items,
      total,
      page,
      pageSize: PAGE_SIZE,
      hasMore: offset + PAGE_SIZE < total,
    };
  }
}
