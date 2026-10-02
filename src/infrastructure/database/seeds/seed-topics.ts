/**
 * Replaces ALL topics with the curated A1–C2 grammar list (data/cefr-topics.ts).
 * - Old quiz questions are deleted (they belong to the old topics).
 * - Quiz history in user_progress is kept; only its topic link is cleared.
 * Run: npm run seed:topics   (uses DATABASE_URL if set, otherwise DB_* env vars)
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { CEFR_TOPICS } from './data/cefr-topics';

dotenv.config();

const MINUTES: Record<string, number> = { A1: 10, A2: 10, B1: 15, B2: 15, C1: 20, C2: 20 };

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? undefined,
  host: process.env.DATABASE_URL ? undefined : (process.env.DB_HOST ?? 'localhost'),
  port: process.env.DATABASE_URL ? undefined : parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DATABASE_URL ? undefined : (process.env.DB_USERNAME ?? 'postgres'),
  password: process.env.DATABASE_URL ? undefined : (process.env.DB_PASSWORD ?? 'postgres'),
  database: process.env.DATABASE_URL ? undefined : (process.env.DB_NAME ?? 'langlearndb'),
  entities: [],
  synchronize: false,
});

async function run() {
  await dataSource.initialize();

  await dataSource.transaction(async (tx) => {
    const unlinked = await tx.query(
      `UPDATE user_progress SET "topicId" = NULL WHERE "topicId" IS NOT NULL`,
    );
    const questions = await tx.query(`DELETE FROM quiz_questions`);
    const topics = await tx.query(`DELETE FROM topics`);
    console.log(
      `Removed ${topics[1]} topics and ${questions[1]} questions; unlinked ${unlinked[1]} progress rows.`,
    );

    for (const [i, t] of CEFR_TOPICS.entries()) {
      await tx.query(
        `INSERT INTO topics (name, "titleTr", description, category, language, "cefrLevel", "csvId",
                             "orderIndex", "estimatedMinutes", icon, "isActive", "isPremium")
         VALUES ($1, $2, $3, 'grammar', 'en', $4, $5, $6, $7, '📖', true, false)`,
        [t.name, t.nameTr, t.example, t.level, t.csvIds.join(',') || null, i + 1, MINUTES[t.level]],
      );
    }
  });

  const counts = await dataSource.query(
    `SELECT "cefrLevel", COUNT(*)::int AS n FROM topics GROUP BY 1 ORDER BY 1`,
  );
  console.log(`Inserted ${CEFR_TOPICS.length} topics:`, counts.map((c: any) => `${c.cefrLevel}=${c.n}`).join(' '));
  await dataSource.destroy();
}

run().catch(async (err) => {
  console.error('Topic seed failed:', err);
  await dataSource.destroy().catch(() => undefined);
  process.exit(1);
});
