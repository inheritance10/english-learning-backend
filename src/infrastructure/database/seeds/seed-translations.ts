/**
 * Gemini Batch Translation Seeder
 * Translates all words in the `words` table into supported languages
 * and stores them in `word_translations`.
 *
 * Run: npm run seed:translations
 *
 * Resumes where it left off — safe to re-run.
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { WordEntity } from '../../../domain/entities/word.entity';
import { WordTranslationEntity } from '../../../domain/entities/word-translation.entity';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPPORTED_LANGUAGES: Record<string, string> = {
  tr: 'Turkish',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  ar: 'Arabic',
};

const BATCH_SIZE = 50;   // words per Gemini call
const DELAY_MS  = 2000;  // delay between calls to avoid rate limits

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

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function translateBatch(
  genAI: GoogleGenerativeAI,
  words: WordEntity[],
  langCode: string,
  langName: string,
): Promise<Array<{ word: string; meaning: string; exampleSentence: string }>> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const wordList = words.map(w => `${w.word} (${w.level})`).join('\n');

  const prompt = `You are a language translator. Translate the following English words into ${langName}.
For each word, provide:
1. A concise ${langName} meaning (1-3 words max)
2. A short example sentence in English showing natural usage (max 12 words)

Words to translate:
${wordList}

Return ONLY a valid JSON array. No markdown, no explanation. Schema:
[{"word": "the English word", "meaning": "${langName} translation", "exampleSentence": "Short English example sentence."}]

Important:
- Keep meanings very short (1-3 ${langName} words)
- Example sentences must be in ENGLISH, not ${langName}
- Return exactly ${words.length} items in the same order`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(json);
}

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.startsWith('your-')) {
    console.error('❌ GEMINI_API_KEY not configured in .env');
    process.exit(1);
  }

  await dataSource.initialize();
  console.log('✅ Database connected');

  const wordRepo = dataSource.getRepository(WordEntity);
  const translationRepo = dataSource.getRepository(WordTranslationEntity);

  const allWords = await wordRepo.find({ order: { level: 'ASC', word: 'ASC' } });
  console.log(`📚 Total words: ${allWords.length}`);

  const genAI = new GoogleGenerativeAI(apiKey);

  for (const [langCode, langName] of Object.entries(SUPPORTED_LANGUAGES)) {
    console.log(`\n🌍 Translating to ${langName} (${langCode})...`);

    // Find words that don't have a translation yet for this language
    const existing = await translationRepo.find({ where: { language: langCode } });
    const existingWordIds = new Set(existing.map(t => t.wordId));
    const pending = allWords.filter(w => !existingWordIds.has(w.id));

    console.log(`   Existing: ${existing.length}, Pending: ${pending.length}`);

    if (pending.length === 0) {
      console.log(`   ✅ Already complete, skipping`);
      continue;
    }

    let successCount = 0;
    let errorCount = 0;

    // Process in batches
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(pending.length / BATCH_SIZE);

      process.stdout.write(`   Batch ${batchNum}/${totalBatches}... `);

      try {
        const translations = await translateBatch(genAI, batch, langCode, langName);

        const toInsert = batch.map((word, idx) => {
          const t = translations.find(tr => tr.word === word.word) ?? translations[idx];
          return translationRepo.create({
            wordId: word.id,
            language: langCode,
            meaning: t?.meaning ?? word.word,
            exampleSentence: t?.exampleSentence ?? null,
          });
        });

        await translationRepo
          .createQueryBuilder()
          .insert()
          .into(WordTranslationEntity)
          .values(toInsert)
          .orIgnore()   // skip if (wordId, language) already exists
          .execute();

        successCount += batch.length;
        console.log(`✅ (${successCount}/${pending.length})`);
      } catch (err: any) {
        errorCount += batch.length;
        console.log(`❌ Error: ${err.message}`);
        // Continue with next batch — will be retried on next run
      }

      if (i + BATCH_SIZE < pending.length) {
        await sleep(DELAY_MS);
      }
    }

    console.log(`   ${langName} done: ${successCount} success, ${errorCount} errors`);
  }

  console.log('\n🎉 Translation seeding complete!');
  await dataSource.destroy();
}

run().catch(err => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
