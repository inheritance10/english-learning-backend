/**
 * Seed script — Word Booster vocabulary database
 * Run: npx ts-node -r tsconfig-paths/register src/infrastructure/database/seeds/seed-words.ts
 */
import { DataSource } from 'typeorm';
import { WordEntity } from '../../../domain/entities/word.entity';
import * as dotenv from 'dotenv';
dotenv.config();

const WORDS: Omit<WordEntity, 'id' | 'createdAt'>[] = [
  // ─── A1 ───────────────────────────────────────────────────────────
  { word: 'hello', meaning: 'merhaba', exampleSentence: 'Hello! How are you?', usageNote: 'Informal greeting', level: 'A1' },
  { word: 'book', meaning: 'kitap', exampleSentence: 'I read a book every night.', usageNote: 'Countable noun', level: 'A1' },
  { word: 'eat', meaning: 'yemek yemek', exampleSentence: 'I eat breakfast at 8 o\'clock.', usageNote: 'eat/ate/eaten', level: 'A1' },
  { word: 'big', meaning: 'büyük', exampleSentence: 'That is a big house.', usageNote: 'Opposite of small', level: 'A1' },
  { word: 'happy', meaning: 'mutlu', exampleSentence: 'She is very happy today.', usageNote: 'Adjective describing emotion', level: 'A1' },
  { word: 'go', meaning: 'gitmek', exampleSentence: 'Let\'s go to the park.', usageNote: 'go/went/gone', level: 'A1' },
  { word: 'water', meaning: 'su', exampleSentence: 'Can I have a glass of water?', usageNote: 'Uncountable noun', level: 'A1' },
  { word: 'family', meaning: 'aile', exampleSentence: 'My family lives in Istanbul.', usageNote: 'Collective noun', level: 'A1' },

  // ─── A2 ───────────────────────────────────────────────────────────
  { word: 'although', meaning: 'her ne kadar... olsa da', exampleSentence: 'Although it was raining, we went out.', usageNote: 'Concession conjunction', level: 'A2' },
  { word: 'describe', meaning: 'tanımlamak', exampleSentence: 'Can you describe your house?', usageNote: 'describe + noun/object', level: 'A2' },
  { word: 'prefer', meaning: 'tercih etmek', exampleSentence: 'I prefer coffee to tea.', usageNote: 'prefer A to B', level: 'A2' },
  { word: 'usually', meaning: 'genellikle', exampleSentence: 'I usually wake up at 7 am.', usageNote: 'Frequency adverb', level: 'A2' },
  { word: 'invitation', meaning: 'davet', exampleSentence: 'Thank you for the invitation to your party.', usageNote: 'Noun form of invite', level: 'A2' },
  { word: 'environment', meaning: 'çevre', exampleSentence: 'We must protect our environment.', usageNote: 'Can mean surroundings or nature', level: 'A2' },
  { word: 'appointment', meaning: 'randevu', exampleSentence: 'I have a doctor\'s appointment tomorrow.', usageNote: 'make / have an appointment', level: 'A2' },
  { word: 'suggest', meaning: 'önermek', exampleSentence: 'I suggest we leave early.', usageNote: 'suggest + -ing or that clause', level: 'A2' },

  // ─── B1 ───────────────────────────────────────────────────────────
  { word: 'consequently', meaning: 'sonuç olarak', exampleSentence: 'She didn\'t study; consequently, she failed.', usageNote: 'Formal linking adverb', level: 'B1' },
  { word: 'emphasise', meaning: 'vurgulamak', exampleSentence: 'He emphasised the importance of practice.', usageNote: 'British spelling; US: emphasize', level: 'B1' },
  { word: 'negotiate', meaning: 'müzakere etmek', exampleSentence: 'They negotiated a better price.', usageNote: 'negotiate with someone / negotiate a deal', level: 'B1' },
  { word: 'whereas', meaning: 'oysa ki / buna karşın', exampleSentence: 'I like coffee, whereas she prefers tea.', usageNote: 'Contrast conjunction', level: 'B1' },
  { word: 'sophisticated', meaning: 'sofistike / karmaşık', exampleSentence: 'This is a sophisticated software system.', usageNote: 'Can describe people, systems or tastes', level: 'B1' },
  { word: 'obligation', meaning: 'yükümlülük', exampleSentence: 'There is no obligation to sign the contract.', usageNote: 'under an obligation to do sth', level: 'B1' },
  { word: 'significant', meaning: 'önemli / anlamlı', exampleSentence: 'There was a significant improvement in her performance.', usageNote: 'Often used in academic/formal writing', level: 'B1' },
  { word: 'persist', meaning: 'ısrar etmek / devam etmek', exampleSentence: 'If symptoms persist, see a doctor.', usageNote: 'persist in doing sth', level: 'B1' },

  // ─── B2 ───────────────────────────────────────────────────────────
  { word: 'ambiguous', meaning: 'belirsiz / çok anlamlı', exampleSentence: 'The instructions were ambiguous and confused everyone.', usageNote: 'Avoid in formal writing when possible', level: 'B2' },
  { word: 'phenomenon', meaning: 'fenomen / olay', exampleSentence: 'Social media is a global phenomenon.', usageNote: 'Plural: phenomena', level: 'B2' },
  { word: 'controversial', meaning: 'tartışmalı', exampleSentence: 'Cloning is a controversial topic in science.', usageNote: 'controversial + noun / it is controversial that', level: 'B2' },
  { word: 'constitute', meaning: 'oluşturmak / teşkil etmek', exampleSentence: 'Women constitute over half of the workforce.', usageNote: 'Formal; similar to make up', level: 'B2' },
  { word: 'inevitable', meaning: 'kaçınılmaz', exampleSentence: 'Change is inevitable in any organisation.', usageNote: 'it is inevitable that + clause', level: 'B2' },
  { word: 'fluctuate', meaning: 'dalgalanmak', exampleSentence: 'Prices fluctuate depending on demand.', usageNote: 'Common in academic/business writing', level: 'B2' },
  { word: 'criterion', meaning: 'kriter', exampleSentence: 'The main criterion for success is dedication.', usageNote: 'Plural: criteria', level: 'B2' },
  { word: 'undermine', meaning: 'baltalamak / zayıflatmak', exampleSentence: 'His comments undermined her confidence.', usageNote: 'undermine + authority/confidence/effort', level: 'B2' },

  // ─── C1 ───────────────────────────────────────────────────────────
  { word: 'predisposition', meaning: 'eğilim / yatkınlık', exampleSentence: 'There is a genetic predisposition to the disease.', usageNote: 'predisposition to/towards sth', level: 'C1' },
  { word: 'ostensibly', meaning: 'görünürde / güya', exampleSentence: 'Ostensibly, the policy aims to reduce poverty.', usageNote: 'Often implies a hidden true motive', level: 'C1' },
  { word: 'corroborate', meaning: 'doğrulamak / desteklemek', exampleSentence: 'Witnesses corroborated her account of the events.', usageNote: 'Formal synonym for confirm/support', level: 'C1' },
  { word: 'pragmatic', meaning: 'pragmatik / pratik', exampleSentence: 'We need a pragmatic approach to the problem.', usageNote: 'Focused on practical outcomes', level: 'C1' },
  { word: 'pervasive', meaning: 'yaygın / her yerde olan', exampleSentence: 'Social media has a pervasive influence on youth.', usageNote: 'Implies spreading widely and thoroughly', level: 'C1' },
  { word: 'reconcile', meaning: 'uzlaştırmak / bağdaştırmak', exampleSentence: 'It is hard to reconcile his words with his actions.', usageNote: 'reconcile sth with sth; also: people reconcile', level: 'C1' },

  // ─── C2 ───────────────────────────────────────────────────────────
  { word: 'sycophant', meaning: 'dalkavuk', exampleSentence: 'The leader was surrounded by sycophants who never challenged him.', usageNote: 'Pejorative; one who flatters for personal gain', level: 'C2' },
  { word: 'equivocate', meaning: 'lafı dolandırmak / muğlak konuşmak', exampleSentence: 'The politician equivocated when asked about the scandal.', usageNote: 'Deliberately vague to avoid commitment', level: 'C2' },
  { word: 'impecunious', meaning: 'parasız / züğürt', exampleSentence: 'As an impecunious student, he relied on scholarships.', usageNote: 'Formal/literary; synonymous with penniless', level: 'C2' },
  { word: 'perspicacious', meaning: 'basiretli / zeki', exampleSentence: 'Her perspicacious analysis impressed the committee.', usageNote: 'Having a ready insight; literary register', level: 'C2' },
  { word: 'obfuscate', meaning: 'karmaşıklaştırmak / bulandırmak', exampleSentence: 'Legal jargon can obfuscate the true meaning of a contract.', usageNote: 'To make something unclear deliberately', level: 'C2' },
  { word: 'ephemeral', meaning: 'geçici / kısa ömürlü', exampleSentence: 'The fame of social media influencers is often ephemeral.', usageNote: 'Lasting for a very short time; literary', level: 'C2' },
];

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'langlearndb',
    entities: [WordEntity],
    synchronize: true,
  });

  await dataSource.initialize();
  const repo = dataSource.getRepository(WordEntity);

  const existing = await repo.count();
  if (existing > 0) {
    console.log(`⚠️  Words table already has ${existing} rows. Skipping seed.`);
    await dataSource.destroy();
    return;
  }

  await repo.insert(WORDS as WordEntity[]);
  console.log(`✅ Seeded ${WORDS.length} words across A1–C2 levels.`);
  await dataSource.destroy();
}

seed().catch(console.error);
