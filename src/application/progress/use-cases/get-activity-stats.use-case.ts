import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReadingActivityEntity } from '../../../domain/entities/reading-activity.entity';
import { WritingActivityEntity } from '../../../domain/entities/writing-activity.entity';
import { UserEntity } from '../../../domain/entities/user.entity';

export interface ActivityStatsResult {
  overview: {
    totalReadingCompleted: number;
    totalWritingCompleted: number;
    totalActivities: number;
    totalTokensEarned: number;
    avgReadingScore: number; // 0-100 percentage
  };
  levelBreakdown: Array<{
    level: string;
    readingCount: number;
    writingCount: number;
  }>;
  last30Days: Array<{
    date: string;
    readingCount: number;
    writingCount: number;
    active: boolean;
  }>;
  recentActivities: Array<{
    id: string;
    type: 'reading' | 'writing';
    title: string;
    cefrLevel: string;
    tokensEarned: number;
    score: number | null;
    completedAt: string;
  }>;
}

@Injectable()
export class GetActivityStatsUseCase {
  constructor(
    @InjectRepository(ReadingActivityEntity)
    private readonly readingRepo: Repository<ReadingActivityEntity>,
    @InjectRepository(WritingActivityEntity)
    private readonly writingRepo: Repository<WritingActivityEntity>,
  ) {}

  async execute(user: UserEntity): Promise<ActivityStatsResult> {
    const [readings, writings] = await Promise.all([
      this.readingRepo.find({
        where: { userId: user.id, isCompleted: true },
        order: { completedAt: 'DESC' },
      }),
      this.writingRepo.find({
        where: { userId: user.id, isCompleted: true },
        order: { completedAt: 'DESC' },
      }),
    ]);

    const totalReadingTokens = readings.reduce((s, r) => s + (r.tokensEarned ?? 0), 0);
    const totalWritingTokens = writings.reduce((s, w) => s + (w.tokensEarned ?? 0), 0);

    const avgReadingScore =
      readings.length > 0
        ? Math.round(
            (readings.reduce((s, r) => {
              const total = r.questions?.length ?? 0;
              return s + (total > 0 ? (r.score / total) * 100 : 0);
            }, 0) /
              readings.length),
          )
        : 0;

    const levelBreakdown = this.buildLevelBreakdown(readings, writings);
    const last30Days = this.buildLast30Days(readings, writings);
    const recentActivities = this.buildRecentActivities(readings, writings);

    return {
      overview: {
        totalReadingCompleted: readings.length,
        totalWritingCompleted: writings.length,
        totalActivities: readings.length + writings.length,
        totalTokensEarned: totalReadingTokens + totalWritingTokens,
        avgReadingScore,
      },
      levelBreakdown,
      last30Days,
      recentActivities,
    };
  }

  private buildLevelBreakdown(
    readings: ReadingActivityEntity[],
    writings: WritingActivityEntity[],
  ) {
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    return levels
      .map(level => ({
        level,
        readingCount: readings.filter(r => r.cefrLevel === level).length,
        writingCount: writings.filter(w => w.cefrLevel === level).length,
      }))
      .filter(l => l.readingCount > 0 || l.writingCount > 0);
  }

  private buildLast30Days(
    readings: ReadingActivityEntity[],
    writings: WritingActivityEntity[],
  ) {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return d.toISOString().split('T')[0];
    });

    return days.map(date => {
      const rc = readings.filter(
        r => r.completedAt && r.completedAt.toISOString().split('T')[0] === date,
      ).length;
      const wc = writings.filter(
        w => w.completedAt && w.completedAt.toISOString().split('T')[0] === date,
      ).length;
      return { date, readingCount: rc, writingCount: wc, active: rc + wc > 0 };
    });
  }

  private buildRecentActivities(
    readings: ReadingActivityEntity[],
    writings: WritingActivityEntity[],
  ) {
    const readingItems = readings.slice(0, 20).map(r => ({
      id: r.id,
      type: 'reading' as const,
      title: r.title,
      cefrLevel: r.cefrLevel,
      tokensEarned: r.tokensEarned ?? 0,
      score: r.questions?.length > 0 ? Math.round((r.score / r.questions.length) * 100) : null,
      completedAt: r.completedAt?.toISOString() ?? '',
    }));

    const writingItems = writings.slice(0, 20).map(w => ({
      id: w.id,
      type: 'writing' as const,
      title: w.scenario?.slice(0, 60) + (w.scenario?.length > 60 ? '…' : ''),
      cefrLevel: w.cefrLevel,
      tokensEarned: w.tokensEarned ?? 0,
      score: null,
      completedAt: w.completedAt?.toISOString() ?? '',
    }));

    return [...readingItems, ...writingItems]
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, 20);
  }
}
