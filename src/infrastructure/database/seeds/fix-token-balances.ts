/**
 * One-off repair: reading/writing rewards were never added to users."totalTokens" (wrong column name),
 * so balances are too low. Raises each balance to at least the tokens earned from activities.
 * Users who have already spent tokens are skipped, so running it twice can't refund a purchase.
 * Run: npm run fix:tokens:prod   (uses DATABASE_URL if set, otherwise DB_* env vars)
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

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
  const [rows, affected] = await dataSource.query(`
    WITH earned AS (
      SELECT u.id,
             COALESCE((SELECT SUM(tokens_earned) FROM reading_activities r WHERE r.user_id = u.id AND r.is_completed), 0)
           + COALESCE((SELECT SUM(tokens_earned) FROM writing_activities w WHERE w.user_id = u.id AND w.is_completed), 0)
           + COALESCE((SELECT SUM("tokensEarned") FROM user_progress p WHERE p."userId" = u.id), 0) AS total
        FROM users u
    )
    UPDATE users u SET "totalTokens" = e.total
      FROM earned e
     WHERE u.id = e.id
       AND u."totalTokens" < e.total
       AND NOT EXISTS (SELECT 1 FROM reward_purchases rp WHERE rp.user_id = u.id)
    RETURNING u.id`);
  console.log(`Token balances repaired for ${affected ?? rows.length} users.`);
  await dataSource.destroy();
}

run().catch(async err => {
  console.error('Token balance repair failed:', err);
  await dataSource.destroy().catch(() => undefined);
  process.exit(1);
});
