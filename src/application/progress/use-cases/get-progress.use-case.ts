import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserEntity } from '../../../domain/entities/user.entity';

const DAY_MS = 86_400_000;
const toDay = (d: Date) => d.toISOString().split('T')[0];

@Injectable()
export class GetProgressUseCase {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async execute(user: UserEntity) {
    const userId = user.id;

    const [dateRows, summaryRows] = await Promise.all([
      // Every day the user completed something: reading, writing or a quiz
      this.db.query(
        `SELECT DISTINCT d FROM (
           SELECT to_char(completed_at, 'YYYY-MM-DD') AS d FROM reading_activities WHERE user_id = $1 AND is_completed
           UNION
           SELECT to_char(completed_at, 'YYYY-MM-DD') FROM writing_activities WHERE user_id = $1 AND is_completed
           UNION
           SELECT date FROM user_progress WHERE "userId" = $1
         ) t WHERE d IS NOT NULL ORDER BY d`,
        [userId],
      ),
      this.db.query(
        `SELECT
           COALESCE((SELECT SUM(score) FROM reading_activities WHERE user_id = $1 AND is_completed), 0)
           + COALESCE((SELECT SUM("correctAnswers") FROM user_progress WHERE "userId" = $1), 0) AS "totalCorrect",
           COALESCE((SELECT SUM(jsonb_array_length(questions::jsonb)) FROM reading_activities WHERE user_id = $1 AND is_completed), 0)
           + COALESCE((SELECT SUM("questionsAnswered") FROM user_progress WHERE "userId" = $1), 0) AS "totalAnswered",
           COALESCE((SELECT SUM(tokens_earned) FROM reading_activities WHERE user_id = $1 AND is_completed), 0)
           + COALESCE((SELECT SUM(tokens_earned) FROM writing_activities WHERE user_id = $1 AND is_completed), 0)
           + COALESCE((SELECT SUM("tokensEarned") FROM user_progress WHERE "userId" = $1), 0) AS "totalTokens"`,
        [userId],
      ),
    ]);

    const activeDays = new Set<string>(dateRows.map((r: { d: string }) => r.d));
    const { currentStreak, longestStreak } = this.computeStreaks(activeDays);

    const s = summaryRows[0];
    const totalAnswered = Number(s.totalAnswered);
    const totalCorrect = Number(s.totalCorrect);

    const today = Date.now();
    const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
      const date = toDay(new Date(today - (6 - i) * DAY_MS));
      return { date, xpEarned: 0, questionsAnswered: 0, active: activeDays.has(date) };
    });

    return {
      summary: {
        totalXp: 0,
        accuracy: totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0,
        currentStreak,
        longestStreak,
        totalDaysActive: activeDays.size,
        totalQuestionsAnswered: totalAnswered,
        totalTokens: Number(s.totalTokens),
      },
      weeklyActivity,
    };
  }

  private computeStreaks(days: Set<string>) {
    const sorted = [...days].sort();
    let longest = 0;
    let run = 0;
    let prev: number | null = null;
    for (const d of sorted) {
      const t = Date.parse(d);
      run = prev !== null && t - prev === DAY_MS ? run + 1 : 1;
      longest = Math.max(longest, run);
      prev = t;
    }

    // Streak is still alive if the user was active today or yesterday
    const now = Date.now();
    let cursor = days.has(toDay(new Date(now))) ? now : now - DAY_MS;
    let current = 0;
    while (days.has(toDay(new Date(cursor)))) {
      current += 1;
      cursor -= DAY_MS;
    }
    return { currentStreak: current, longestStreak: longest };
  }
}
