/**
 * Oxford 3000 Word Seeder
 * Parses the Oxford 3000 CSV and inserts words into the `words` table.
 *
 * Expected CSV columns (case-insensitive):
 *   word, level  (e.g. "hello", "A1")
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

// ─── CSV paths to search ─────────────────────────────────────────────────────
const CSV_PATHS = [
  path.join(__dirname, '../../../../oxford-3000.csv'),
  path.join(process.env.HOME ?? '', 'Downloads/oxford-3000.csv'),
  path.join(process.env.HOME ?? '', 'Desktop/oxford-3000.csv'),
  '/tmp/oxford-3000.csv',
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

const VALID_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

async function run() {
  // Find CSV
  let csvPath: string | null = null;
  for (const p of CSV_PATHS) {
    if (fs.existsSync(p)) { csvPath = p; break; }
  }

  if (!csvPath) {
    console.error('❌ Oxford CSV not found. Place it at one of:');
    CSV_PATHS.forEach(p => console.error('  -', p));
    process.exit(1);
  }

  console.log(`📂 Reading: ${csvPath}`);

  const lines = fs.readFileSync(csvPath, 'utf-8').split('\n');
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());

  const wordIdx = headers.findIndex(h => h.includes('word'));
  const levelIdx = headers.findIndex(h => h.includes('level') || h.includes('cefr'));

  if (wordIdx === -1 || levelIdx === -1) {
    console.error(`❌ CSV must have "word" and "level" columns. Found: ${headers.join(', ')}`);
    process.exit(1);
  }

  await dataSource.initialize();
  console.log('✅ Database connected');

  const repo = dataSource.getRepository(WordEntity);
  const existing = await repo.count();
  console.log(`ℹ️  Current words in DB: ${existing}`);

  let added = 0;
  let skipped = 0;
  const levelStats: Record<string, number> = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    const word = cols[wordIdx]?.toLowerCase().trim();
    const rawLevel = cols[levelIdx]?.toUpperCase().trim();
    const level = rawLevel?.split(/[-,]/)[0]; // take first part e.g. "A1-A2" → "A1"

    if (!word || !level || !VALID_LEVELS.has(level)) {
      skipped++;
      continue;
    }

    // Skip if already exists (word + level combo)
    const exists = await repo.findOne({ where: { word, level } });
    if (exists) { skipped++; continue; }

    await repo.save(repo.create({
      word,
      meaning: word,          // placeholder — will be filled by seed:translations
      exampleSentence: null,
      usageNote: null,
      level,
    }));

    added++;
    levelStats[level] = (levelStats[level] ?? 0) + 1;

    if (added % 100 === 0) console.log(`  → ${added} words added...`);
  }

  console.log(`\n✅ Done: ${added} added, ${skipped} skipped`);
  console.log('📊 Level breakdown:');
  Object.keys(levelStats).sort().forEach(l => console.log(`   ${l}: ${levelStats[l]}`));

  await dataSource.destroy();
}

run().catch(err => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
