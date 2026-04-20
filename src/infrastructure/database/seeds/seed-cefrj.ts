/**
 * CEFR-J Grammar Profile Full Seeder
 * Tüm 500 satırı olduğu gibi DB'ye aktarır.
 * Çalıştır: npm run seed:cefrj
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { TopicEntity } from '../../../domain/entities/topic.entity';
import { UserEntity } from '../../../domain/entities/user.entity';
import { SubscriptionEntity } from '../../../domain/entities/subscription.entity';
import { QuizQuestionEntity } from '../../../domain/entities/quiz-question.entity';
import { UserProgressEntity } from '../../../domain/entities/user-progress.entity';
import { VocabularyItemEntity } from '../../../domain/entities/vocabulary-item.entity';
import { DailyStreakEntity } from '../../../domain/entities/daily-streak.entity';
import * as dotenv from 'dotenv';

dotenv.config();

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseCSV(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ─── Primary CEFR level belirleme ────────────────────────────────────────────
function extractFirstLevel(val: string): string | null {
  if (!val) return null;
  // "A1-C2", "A2-B1" gibi range'lerin ilk kısmını al, N/A'yı atla
  const first = val.split(',')[0].trim().split('-')[0].trim();
  if (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(first)) return first;
  return null;
}

function getPrimaryLevel(row: Record<string, string>): string | null {
  // Öncelik: CEFR-J Level > GSELO > Core Inventory > EGP > FREQ*DISP
  const cefrJ = row['CEFR-J Level'].trim();
  if (cefrJ) return extractFirstLevel(cefrJ.split('.')[0]) ?? extractFirstLevel(cefrJ);

  return (
    extractFirstLevel(row['GSELO']) ||
    extractFirstLevel(row['Core Inventory']) ||
    extractFirstLevel(row['EGP']) ||
    extractFirstLevel(row['FREQ*DISP']) ||
    null
  );
}

function getEstimatedMinutes(level: string | null): number {
  if (!level) return 20;
  if (['A1', 'A2'].includes(level)) return 15;
  if (['B1', 'B2'].includes(level)) return 20;
  return 25;
}

// ─── DataSource ───────────────────────────────────────────────────────────────
const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? undefined,
  host: process.env.DATABASE_URL ? undefined : (process.env.DB_HOST ?? 'localhost'),
  port: process.env.DATABASE_URL ? undefined : parseInt(process.env.DB_PORT ?? '5432'),
  username: process.env.DATABASE_URL ? undefined : (process.env.DB_USERNAME ?? 'postgres'),
  password: process.env.DATABASE_URL ? undefined : (process.env.DB_PASSWORD ?? 'postgres'),
  database: process.env.DATABASE_URL ? undefined : (process.env.DB_NAME ?? 'langlearndb'),
  entities: [
    TopicEntity, UserEntity, SubscriptionEntity, QuizQuestionEntity,
    UserProgressEntity, VocabularyItemEntity, DailyStreakEntity,
  ],
  synchronize: true,
});

async function seedCEFRJ() {
  await dataSource.initialize();
  console.log('✅ Database bağlandı');

  // CSV dosyasını bul
  const csvPaths = [
    path.join(__dirname, '../../../../cefrj-grammar-profile-20180315.csv'),
    path.join(process.env.HOME ?? '', 'Downloads/cefrj-grammar-profile-20180315.csv'),
    '/tmp/cefrj-grammar-profile-20180315.csv',
  ];

  let csvPath: string | null = null;
  for (const p of csvPaths) {
    if (fs.existsSync(p)) { csvPath = p; break; }
  }

  if (!csvPath) {
    console.error('❌ CSV bulunamadı. Şu konumlardan birine koy:');
    csvPaths.forEach(p => console.error('  -', p));
    process.exit(1);
  }

  console.log(`📂 CSV: ${csvPath}`);
  const rows = parseCSV(csvPath);
  console.log(`📊 ${rows.length} satır okundu\n`);

  const topicRepo = dataSource.getRepository(TopicEntity);

  // Mevcut tüm kayıtları temizle
  await topicRepo.delete({ language: 'en' });
  console.log('🗑️  Mevcut EN topic\'ler silindi\n');

  let added = 0;
  let noLevel = 0;
  const levelStats: Record<string, number> = {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = row['Grammatical Item'].trim();
    if (!name) continue;

    const cefrJLevel = row['CEFR-J Level'].trim() || undefined;
    const primaryLevel = getPrimaryLevel(row);
    const shorthandCode = row['Shorthand Code'].trim() || undefined;
    const sentenceType = row['Sentence Type'].trim() || undefined;
    const freqDisp = row['FREQ*DISP'].trim() || undefined;
    const coreInventory = row['Core Inventory'].trim() || undefined;
    const egp = row['EGP'].trim() || undefined;
    const gselo = row['GSELO'].trim() || undefined;
    const notes = row['Notes'].trim() || undefined;
    const csvId = row['ID'].trim() || undefined;

    const description = sentenceType ? `${name} (${sentenceType})` : name;

    if (!primaryLevel) noLevel++;
    if (primaryLevel) {
      levelStats[primaryLevel] = (levelStats[primaryLevel] ?? 0) + 1;
    }

    await topicRepo.save(topicRepo.create({
      name,
      description,
      category: 'grammar',
      language: 'en',
      cefrLevel: primaryLevel ?? undefined,
      cefrJLevel,
      shorthandCode,
      sentenceType,
      freqDisp,
      coreInventory,
      egp,
      gselo,
      notes,
      csvId,
      orderIndex: i + 1,
      estimatedMinutes: getEstimatedMinutes(primaryLevel),
      icon: '📖',
      isActive: true,
      isPremium: false,
    }));

    added++;
    if (added % 100 === 0) console.log(`  → ${added}/${rows.length} eklendi...`);
  }

  console.log(`\n✅ Seed tamamlandı:`);
  console.log(`   Toplam eklenen: ${added}`);
  console.log(`   Level belirlenemeyen: ${noLevel} (null olarak kaydedildi)`);
  console.log(`\n📊 Seviye dağılımı:`);
  Object.keys(levelStats).sort().forEach(lvl => {
    console.log(`   ${lvl}: ${levelStats[lvl]} topic`);
  });

  await dataSource.destroy();
}

seedCEFRJ().catch(err => {
  console.error('❌ Seed başarısız:', err.message);
  process.exit(1);
});
