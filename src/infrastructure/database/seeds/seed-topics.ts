/**
 * Syncs topics with data/cefr-topics.ts (matched by name + level):
 * inserts missing topics and updates the fields of existing ones. Never deletes anything,
 * so quiz questions and user history stay intact. Safe to run repeatedly.
 * Run: npm run seed:topics:prod   (uses DATABASE_URL if set, otherwise DB_* env vars)
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
  let inserted = 0;
  let updated = 0;

  await dataSource.transaction(async (tx) => {
    for (const [i, t] of CEFR_TOPICS.entries()) {
      const values = [t.nameTr, t.example, 'grammar', t.csvIds.join(',') || null, i + 1, MINUTES[t.level], '📖'];
      const [, count] = await tx.query(
        `UPDATE topics SET "titleTr" = $3, description = $4, category = $5, "csvId" = $6,
                "orderIndex" = $7, "estimatedMinutes" = $8, icon = $9
          WHERE name = $1 AND "cefrLevel" = $2`,
        [t.name, t.level, ...values],
      );
      if (count) {
        updated++;
        continue;
      }
      await tx.query(
        `INSERT INTO topics (name, "cefrLevel", "titleTr", description, category, "csvId", "orderIndex",
                             "estimatedMinutes", icon, language, "isActive", "isPremium")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'en', true, false)`,
        [t.name, t.level, ...values],
      );
      inserted++;
    }
  });

  const counts = await dataSource.query(
    `SELECT "cefrLevel" AS level, category, COUNT(*)::int AS n FROM topics WHERE "isActive" GROUP BY 1, 2 ORDER BY 1, 2`,
  );
  console.log(`Topics synced: ${inserted} inserted, ${updated} updated.`);
  console.table(counts);
  await dataSource.destroy();
}

run().catch(async (err) => {
  console.error('Topic seed failed:', err);
  await dataSource.destroy().catch(() => undefined);
  process.exit(1);
});
