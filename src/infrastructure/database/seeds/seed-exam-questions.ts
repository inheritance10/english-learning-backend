/**
 * Seed script for exam prep questions.
 * Run with: npx ts-node src/infrastructure/database/seeds/seed-exam-questions.ts
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { ExamPrepService } from '../../../application/exam-prep/exam-prep.service';
import { ImportQuestionDto } from '../../../application/exam-prep/dto/import-question.dto';

const questions: ImportQuestionDto[] = [
  // ─── IELTS Grammar: Gerund & Infinitive ───────────────────────────────────
  {
    examName: 'IELTS',
    categoryName: 'Grammar',
    content:
      'She avoided _______ eye contact during the difficult conversation with her manager.',
    options: [
      'A) to make',
      'B) making',
      'C) made',
      'D) make',
    ],
    correctIndex: 1,
    explanation:
      '"Avoid" is always followed by a gerund (verb + -ing), not an infinitive.',
    difficultyLevel: 'medium',
    topicTag: 'Gerund & Infinitive',
    isOriginal: true,
  },
  // ─── IELTS Grammar: Relative Clauses ──────────────────────────────────────
  {
    examName: 'IELTS',
    categoryName: 'Grammar',
    content:
      'The scientist _______ research led to the discovery of a new vaccine was awarded the Nobel Prize.',
    options: [
      'A) whose',
      'B) who',
      'C) which',
      'D) whom',
    ],
    correctIndex: 0,
    explanation:
      '"Whose" is the possessive relative pronoun used to show that the research belongs to the scientist.',
    difficultyLevel: 'medium',
    topicTag: 'Relative Clauses',
    isOriginal: true,
  },
  // ─── IELTS Grammar: Conditionals ──────────────────────────────────────────
  {
    examName: 'IELTS',
    categoryName: 'Grammar',
    content:
      'If the government _______ more funds to education, literacy rates would have improved significantly.',
    options: [
      'A) allocated',
      'B) had allocated',
      'C) would allocate',
      'D) has allocated',
    ],
    correctIndex: 1,
    explanation:
      'Third conditional: "if + past perfect, would have + past participle" — used for hypothetical past situations.',
    difficultyLevel: 'hard',
    topicTag: 'Conditionals',
    isOriginal: true,
  },
  // ─── IELTS Vocabulary: Academic Word List ─────────────────────────────────
  {
    examName: 'IELTS',
    categoryName: 'Vocabulary',
    content:
      'The researchers were able to _______ their findings by conducting a series of controlled experiments.',
    options: [
      'A) contradict',
      'B) substantiate',
      'C) exaggerate',
      'D) dismiss',
    ],
    correctIndex: 1,
    explanation:
      '"Substantiate" means to provide evidence to support or prove the truth of something — a key academic word.',
    difficultyLevel: 'hard',
    topicTag: 'Academic Word List',
    isOriginal: true,
  },
  {
    examName: 'IELTS',
    categoryName: 'Vocabulary',
    content:
      'The report highlighted several _______ factors that contributed to the economic downturn, including poor regulation.',
    options: [
      'A) trivial',
      'B) negligible',
      'C) underlying',
      'D) superficial',
    ],
    correctIndex: 2,
    explanation:
      '"Underlying" means forming the basis of something — often used in academic writing to describe root causes.',
    difficultyLevel: 'medium',
    topicTag: 'Academic Word List',
    isOriginal: true,
  },
  {
    examName: 'IELTS',
    categoryName: 'Vocabulary',
    content:
      'Despite the _______ evidence, the committee chose to delay its decision pending further review.',
    options: [
      'A) ambiguous',
      'B) compelling',
      'C) irrelevant',
      'D) redundant',
    ],
    correctIndex: 1,
    explanation:
      '"Compelling" means convincing or forceful — the sentence implies the evidence was strong yet ignored.',
    difficultyLevel: 'medium',
    topicTag: 'Academic Word List',
    isOriginal: true,
  },
  // ─── TOEFL Reading: Main Idea ─────────────────────────────────────────────
  {
    examName: 'TOEFL',
    categoryName: 'Reading',
    content:
      'A passage states: "Coral reefs, often called the rainforests of the sea, support approximately 25% of all marine species despite covering less than 1% of the ocean floor." What is the main idea of this sentence?',
    options: [
      'A) Coral reefs are similar to rainforests in appearance.',
      'B) Coral reefs cover a large portion of the ocean floor.',
      'C) Coral reefs are remarkably biodiverse relative to their size.',
      'D) Marine species depend entirely on coral reefs for survival.',
    ],
    correctIndex: 2,
    explanation:
      'The sentence emphasizes the high biodiversity (25% of species) supported by a small area (less than 1%), making option C the correct main idea.',
    difficultyLevel: 'medium',
    topicTag: 'Main Idea',
    isOriginal: true,
  },
  // ─── TOEFL Reading: Vocabulary in Context ────────────────────────────────
  {
    examName: 'TOEFL',
    categoryName: 'Reading',
    content:
      'In the sentence "The archaeologist\'s meticulous excavation revealed artifacts that had been undisturbed for millennia," the word "meticulous" most nearly means:',
    options: [
      'A) reckless',
      'B) extremely careful and precise',
      'C) quick and efficient',
      'D) collaborative',
    ],
    correctIndex: 1,
    explanation:
      '"Meticulous" describes someone who pays great attention to detail and is very careful — the context of a delicate excavation supports this meaning.',
    difficultyLevel: 'medium',
    topicTag: 'Vocabulary in Context',
    isOriginal: true,
  },
  // ─── TOEFL Reading: Inference ────────────────────────────────────────────
  {
    examName: 'TOEFL',
    categoryName: 'Reading',
    content:
      'A passage states: "Early astronomers lacked telescopes yet accurately mapped star positions using only careful naked-eye observations over many years." What can be inferred from this statement?',
    options: [
      'A) Early astronomers were more skilled than modern ones.',
      'B) Telescopes are not necessary for astronomical study.',
      'C) Systematic observation over time can yield accurate scientific results.',
      'D) Naked-eye observations are more reliable than telescope data.',
    ],
    correctIndex: 2,
    explanation:
      'The passage implies that careful, long-term systematic observation — even without advanced tools — can produce accurate results. This is the underlying inference.',
    difficultyLevel: 'hard',
    topicTag: 'Inference',
    isOriginal: true,
  },
  // ─── TOEIC Grammar: Prepositions ─────────────────────────────────────────
  {
    examName: 'TOEIC',
    categoryName: 'Grammar',
    content:
      'The merger agreement must be signed _______ the end of the fiscal quarter to avoid penalties.',
    options: [
      'A) until',
      'B) during',
      'C) by',
      'D) since',
    ],
    correctIndex: 2,
    explanation:
      '"By" indicates a deadline — the action must be completed no later than a specific time. "Until" implies a continuous action up to a point.',
    difficultyLevel: 'medium',
    topicTag: 'Prepositions',
    isOriginal: true,
  },
  // ─── TOEIC Grammar: Tenses ───────────────────────────────────────────────
  {
    examName: 'TOEIC',
    categoryName: 'Grammar',
    content:
      'By the time the new director arrives next month, the team _______ the project for six months.',
    options: [
      'A) will have been working on',
      'B) has been working on',
      'C) worked on',
      'D) is working on',
    ],
    correctIndex: 0,
    explanation:
      'Future perfect continuous ("will have been + verb-ing") expresses an ongoing action that will be in progress up to a future point in time.',
    difficultyLevel: 'hard',
    topicTag: 'Tenses',
    isOriginal: true,
  },
  // ─── TOEIC Grammar: Articles ─────────────────────────────────────────────
  {
    examName: 'TOEIC',
    categoryName: 'Grammar',
    content:
      'Please submit _______ expense report before Friday so that reimbursements can be processed.',
    options: [
      'A) a',
      'B) an',
      'C) the',
      'D) (no article)',
    ],
    correctIndex: 2,
    explanation:
      '"The" is used here because both speaker and listener know which specific expense report is being referred to — it has been previously established in context.',
    difficultyLevel: 'easy',
    topicTag: 'Articles',
    isOriginal: true,
  },
  // ─── TOEIC Vocabulary: Business Vocabulary ───────────────────────────────
  {
    examName: 'TOEIC',
    categoryName: 'Vocabulary',
    content:
      'The board of directors decided to _______ the product launch by three months due to supply chain disruptions.',
    options: [
      'A) accelerate',
      'B) postpone',
      'C) confirm',
      'D) authorize',
    ],
    correctIndex: 1,
    explanation:
      '"Postpone" means to delay or reschedule to a later time — consistent with "three months" delay due to supply chain problems.',
    difficultyLevel: 'easy',
    topicTag: 'Business Vocabulary',
    isOriginal: true,
  },
  {
    examName: 'TOEIC',
    categoryName: 'Vocabulary',
    content:
      'After reviewing the contract, our legal team recommended several _______ to protect the company\'s intellectual property.',
    options: [
      'A) revenues',
      'B) dividends',
      'C) amendments',
      'D) invoices',
    ],
    correctIndex: 2,
    explanation:
      '"Amendments" are formal changes or additions to a legal document — the correct business term in this context.',
    difficultyLevel: 'medium',
    topicTag: 'Business Vocabulary',
    isOriginal: true,
  },
  {
    examName: 'TOEIC',
    categoryName: 'Vocabulary',
    content:
      'The company\'s strong Q3 results exceeded analyst _______ and led to a 12% rise in share price.',
    options: [
      'A) complaints',
      'B) projections',
      'C) disputes',
      'D) liabilities',
    ],
    correctIndex: 1,
    explanation:
      '"Projections" are financial forecasts or estimates — analysts make projections about expected results.',
    difficultyLevel: 'medium',
    topicTag: 'Business Vocabulary',
    isOriginal: true,
  },
];

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const examPrepService = app.get(ExamPrepService);

  console.log(`Importing ${questions.length} exam questions...`);
  const result = await examPrepService.bulkImport(questions);
  console.log(`Successfully imported ${result.imported} questions.`);

  await app.close();
  process.exit(0);
}

bootstrap().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
