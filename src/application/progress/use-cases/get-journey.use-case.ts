import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserEntity } from '../../../domain/entities/user.entity';

export interface JourneyResult {
  totals: {
    wordsLearned: number;
    wordsLearning: number;
    tokens: number;
    activities: number;
    learnedLast30Days: number;
  };
  wordsTimeline: Array<{ date: string; total: number }>;
  weeklyTokens: Array<{ week: string; reading: number; writing: number; quiz: number }>;
  activityBreakdown: { reading: number; writing: number; quiz: number };
  levels: Array<{ level: string; learned: number; total: number }>;
  quizLevels: Array<{
    level: string;
    topicsPracticed: number;
    topicsTotal: number;
    questions: number;
    correct: number;
  }>;
}

const TIMELINE_DAYS = 30;
const TOKEN_WEEKS = 8;
const LEARNED = `('known', 'mastered')`;

@Injectable()
export class GetJourneyUseCase {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async execute(user: UserEntity): Promise<JourneyResult> {
    const id = user.id;

    const [timeline, weekly, counts, levels, wordTotals, quizLevels] = await Promise.all([
      // "learned" date ≈ last swipe/review; good enough to show the trend
      this.db.query(
        `SELECT to_char(d, 'YYYY-MM-DD') AS date,
                (SELECT COUNT(*) FROM user_word_srs s
                  WHERE s.user_id = $1 AND s.status IN ${LEARNED}
                    AND COALESCE(s.last_reviewed_at, s."createdAt") < d + interval '1 day')::int AS total
           FROM generate_series(current_date - ($2::int - 1), current_date, interval '1 day') AS d
          ORDER BY d`,
        [id, TIMELINE_DAYS],
      ),
      this.db.query(
        `WITH weeks AS (
           SELECT generate_series(date_trunc('week', now()) - ($2::int - 1) * interval '1 week',
                                  date_trunc('week', now()), interval '1 week') AS w
         )
         SELECT to_char(w, 'YYYY-MM-DD') AS week,
                COALESCE((SELECT SUM(tokens_earned) FROM reading_activities r
                           WHERE r.user_id = $1 AND r.is_completed
                             AND r.completed_at >= w AND r.completed_at < w + interval '1 week'), 0)::int AS reading,
                COALESCE((SELECT SUM(tokens_earned) FROM writing_activities x
                           WHERE x.user_id = $1 AND x.is_completed
                             AND x.completed_at >= w AND x.completed_at < w + interval '1 week'), 0)::int AS writing,
                COALESCE((SELECT SUM("tokensEarned") FROM user_progress p
                           WHERE p."userId" = $1
                             AND p.date >= to_char(w, 'YYYY-MM-DD')
                             AND p.date < to_char(w + interval '1 week', 'YYYY-MM-DD')), 0)::int AS quiz
           FROM weeks ORDER BY w`,
        [id, TOKEN_WEEKS],
      ),
      this.db.query(
        `SELECT
           (SELECT COUNT(*) FROM reading_activities WHERE user_id = $1 AND is_completed)::int AS reading,
           (SELECT COUNT(*) FROM writing_activities WHERE user_id = $1 AND is_completed)::int AS writing,
           (SELECT COUNT(*) FROM user_progress WHERE "userId" = $1 AND "questionsAnswered" > 0)::int AS quiz,
           (SELECT COUNT(*) FROM user_word_srs WHERE user_id = $1 AND status IN ${LEARNED})::int AS learned,
           (SELECT COUNT(*) FROM user_word_srs WHERE user_id = $1 AND status = 'unknown')::int AS learning,
           (SELECT COUNT(*) FROM user_word_srs WHERE user_id = $1 AND status IN ${LEARNED}
              AND COALESCE(last_reviewed_at, "createdAt") >= current_date - ($2::int - 1))::int AS recent,
           (COALESCE((SELECT SUM(tokens_earned) FROM reading_activities WHERE user_id = $1 AND is_completed), 0)
            + COALESCE((SELECT SUM(tokens_earned) FROM writing_activities WHERE user_id = $1 AND is_completed), 0)
            + COALESCE((SELECT SUM("tokensEarned") FROM user_progress WHERE "userId" = $1), 0))::int AS tokens`,
        [id, TIMELINE_DAYS],
      ),
      this.db.query(
        `SELECT w.level, COUNT(*)::int AS learned
           FROM user_word_srs s JOIN words w ON w.id = s.word_id
          WHERE s.user_id = $1 AND s.status IN ${LEARNED}
          GROUP BY w.level`,
        [id],
      ),
      this.db.query(`SELECT level, COUNT(DISTINCT word)::int AS total FROM words GROUP BY level ORDER BY level`),
      // Every active topic level, with what the user has practised in it
      this.db.query(
        `SELECT t."cefrLevel" AS level,
                COUNT(DISTINCT t.id)::int AS "topicsTotal",
                COUNT(DISTINCT p."topicId")::int AS "topicsPracticed",
                COALESCE(SUM(p."questionsAnswered"), 0)::int AS questions,
                COALESCE(SUM(p."correctAnswers"), 0)::int AS correct
           FROM topics t
           LEFT JOIN user_progress p ON p."topicId" = t.id AND p."userId" = $1 AND p."questionsAnswered" > 0
          WHERE t."isActive" AND t."cefrLevel" IS NOT NULL
          GROUP BY t."cefrLevel"
          ORDER BY t."cefrLevel"`,
        [id],
      ),
    ]);

    const c = counts[0];
    const learnedByLevel = new Map<string, number>(levels.map((l: any) => [l.level, l.learned]));

    return {
      totals: {
        wordsLearned: c.learned,
        wordsLearning: c.learning,
        tokens: c.tokens,
        activities: c.reading + c.writing + c.quiz,
        learnedLast30Days: c.recent,
      },
      wordsTimeline: timeline,
      weeklyTokens: weekly,
      activityBreakdown: { reading: c.reading, writing: c.writing, quiz: c.quiz },
      levels: wordTotals.map((l: any) => ({ level: l.level, learned: learnedByLevel.get(l.level) ?? 0, total: l.total })),
      quizLevels,
    };
  }
}
