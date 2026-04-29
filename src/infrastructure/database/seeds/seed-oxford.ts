/**
 * Oxford Word Seeder
 * Processes a1.csv, a2.csv, b1.csv, b2.csv files from the backend root.
 *
 * CSV format:
 *   word,type,level
 *   "a, an",article,A1
 *   about,"preposition, adverb",A1
 *
 * Run: npm run seed:oxford
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { WordEntity } from '../../../domain/entities/word.entity';
import { WordTranslationEntity } from '../../../domain/entities/word-translation.entity';
import * as dotenv from 'dotenv';
dotenv.config();

// ─── CSV files (in order) ─────────────────────────────────────────────────────
const LEVEL_FILES: { file: string; level: string }[] = [
  { file: 'a1.csv', level: 'A1' },
  { file: 'a2.csv', level: 'A2' },
  { file: 'b1.csv', level: 'B1' },
  { file: 'b2.csv', level: 'B2' },
];

// Search in backend root and /app (Docker)
const BASE_DIRS = [
  path.join(__dirname, '../../../../'),   // backend root (local dev)
  '/app/',                                 // Docker container
];

// ─── DataSource ───────────────────────────────────────────────────────────────
const databaseUrl = process.env.DATABASE_URL;
const dataSource = new DataSource({
  type: 'postgres',
  ...(databaseUrl
    ? { url: databaseUrl }
    : {
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        username: process.env.DB_USERNAME ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'postgres',
        database: process.env.DB_NAME ?? 'langlearndb',
      }),
  entities: [WordEntity, WordTranslationEntity],
  synchronize: false,
});

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

function findFile(filename: string): string | null {
  for (const base of BASE_DIRS) {
    const p = path.join(base, filename);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function processFile(
  csvPath: string,
  expectedLevel: string,
  repo: ReturnType<typeof dataSource.getRepository<WordEntity>>,
): Promise<{ added: number; skipped: number }> {
  const lines = fs.readFileSync(csvPath, 'utf-8').split('\n');
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

  const wordIdx = headers.findIndex(h => h === 'word');
  const typeIdx = headers.findIndex(h => h === 'type');

  if (wordIdx === -1) {
    console.error(`  ❌ No "word" column found. Headers: ${headers.join(', ')}`);
    return { added: 0, skipped: 0 };
  }

  // Batch insert for performance
  const toInsert: Partial<WordEntity>[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    const word = cols[wordIdx]?.toLowerCase().trim();
    const usageNote = typeIdx !== -1 ? cols[typeIdx]?.trim() : null;

    if (!word) { skipped++; continue; }

    toInsert.push({
      word,
      meaning: word,        // placeholder — seed:translations will fill this
      exampleSentence: null,
      usageNote: usageNote ?? null,
      level: expectedLevel,
    });
  }

  if (toInsert.length === 0) return { added: 0, skipped };

  // Use INSERT ... ON CONFLICT DO NOTHING to skip duplicates efficiently
  const result = await repo
    .createQueryBuilder()
    .insert()
    .into(WordEntity)
    .values(toInsert as WordEntity[])
    .orIgnore()
    .execute();

  const added = result.identifiers.length;
  return { added, skipped: skipped + (toInsert.length - added) };
}

async function run() {
  await dataSource.initialize();
  console.log('✅ Database connected\n');

  // Add unique constraint on (word, level) if not exists — safe to run multiple times
  await dataSource.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_words_word_level ON words (word, level);
  `).catch(() => { /* ignore if already exists */ });

  const repo = dataSource.getRepository(WordEntity);
  const before = await repo.count();
  console.log(`ℹ️  Words in DB before: ${before}\n`);

  let totalAdded = 0;
  let totalSkipped = 0;

  for (const { file, level } of LEVEL_FILES) {
    const csvPath = findFile(file);
    if (!csvPath) {
      console.warn(`⚠️  ${file} not found — skipping ${level}`);
      console.warn(`   Place it in the backend root folder (next to package.json)`);
      continue;
    }

    console.log(`📂 Processing ${file} (${level})...`);
    const { added, skipped } = await processFile(csvPath, level, repo);
    console.log(`   ✅ Added: ${added}, Skipped: ${skipped}`);
    totalAdded += added;
    totalSkipped += skipped;
  }

  const after = await repo.count();
  console.log(`\n🎉 Done! Added: ${totalAdded}, Skipped: ${totalSkipped}`);
  console.log(`📊 Total words in DB: ${after}`);

  await dataSource.destroy();
}

run().catch(err => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
