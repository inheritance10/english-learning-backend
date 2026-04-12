/**
 * Database seeder — populates topics with initial data.
 * Run with: npm run seed
 */
import 'reflect-metadata';
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

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432'),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'langlearndb',
  entities: [
    TopicEntity,
    UserEntity,
    SubscriptionEntity,
    QuizQuestionEntity,
    UserProgressEntity,
    VocabularyItemEntity,
    DailyStreakEntity,
  ],
  synchronize: true,
});

const TOPICS = [
  // Grammar
  { name: 'Present Simple', category: 'grammar', cefrLevel: 'A1', language: 'en', orderIndex: 1, description: 'Habits, routines, and general truths', estimatedMinutes: 15, icon: '📖' },
  { name: 'Present Continuous', category: 'grammar', cefrLevel: 'A1', language: 'en', orderIndex: 2, description: 'Actions happening right now', estimatedMinutes: 15, icon: '⏱️' },
  { name: 'Past Simple', category: 'grammar', cefrLevel: 'A2', language: 'en', orderIndex: 3, description: 'Completed actions in the past', estimatedMinutes: 20, icon: '📅' },
  { name: 'Past Continuous', category: 'grammar', cefrLevel: 'A2', language: 'en', orderIndex: 4, description: 'Ongoing past actions', estimatedMinutes: 20, icon: '🔄' },
  { name: 'Present Perfect', category: 'grammar', cefrLevel: 'B1', language: 'en', orderIndex: 5, description: 'Past actions with present relevance', estimatedMinutes: 25, icon: '✅' },
  { name: 'Past Perfect', category: 'grammar', cefrLevel: 'B1', language: 'en', orderIndex: 6, description: 'Actions before another past event', estimatedMinutes: 25, icon: '⬅️' },
  { name: 'Modal Verbs', category: 'grammar', cefrLevel: 'B2', language: 'en', orderIndex: 7, description: 'Can, could, should, would, might', estimatedMinutes: 30, icon: '🎯' },
  { name: 'Conditionals (0, 1, 2)', category: 'grammar', cefrLevel: 'B2', language: 'en', orderIndex: 8, description: 'If clauses and their results', estimatedMinutes: 30, icon: '🔀' },
  { name: 'Third Conditional', category: 'grammar', cefrLevel: 'C1', language: 'en', orderIndex: 9, description: 'Hypothetical past situations', estimatedMinutes: 30, icon: '💭' },
  { name: 'Passive Voice', category: 'grammar', cefrLevel: 'B2', language: 'en', orderIndex: 10, description: 'When the action is more important', estimatedMinutes: 25, icon: '↩️' },
  { name: 'Reported Speech', category: 'grammar', cefrLevel: 'B2', language: 'en', orderIndex: 11, description: 'How to report what others said', estimatedMinutes: 25, icon: '💬' },
  { name: 'Articles (a/an/the)', category: 'grammar', cefrLevel: 'A1', language: 'en', orderIndex: 12, description: 'When and how to use articles', estimatedMinutes: 15, icon: '📝' },

  // Vocabulary
  { name: 'Travel & Transport', category: 'vocabulary', cefrLevel: 'A2', language: 'en', orderIndex: 20, description: 'Vocabulary for getting around', estimatedMinutes: 20, icon: '✈️' },
  { name: 'Food & Cooking', category: 'vocabulary', cefrLevel: 'A1', language: 'en', orderIndex: 21, description: 'Kitchen and restaurant words', estimatedMinutes: 15, icon: '🍳' },
  { name: 'Technology & AI', category: 'vocabulary', cefrLevel: 'B2', language: 'en', orderIndex: 22, description: 'Modern tech terminology', estimatedMinutes: 25, icon: '💻' },
  { name: 'Business Vocabulary', category: 'vocabulary', cefrLevel: 'B2', language: 'en', orderIndex: 23, description: 'Professional workplace words', estimatedMinutes: 30, icon: '💼' },
  { name: 'Academic Word List', category: 'vocabulary', cefrLevel: 'C1', language: 'en', orderIndex: 24, description: 'High-frequency academic vocabulary', estimatedMinutes: 35, icon: '🎓' },

  // Business English
  { name: 'Email Writing', category: 'business', cefrLevel: 'B1', language: 'en', orderIndex: 30, description: 'Professional email etiquette', estimatedMinutes: 30, icon: '📧' },
  { name: 'Meeting Language', category: 'business', cefrLevel: 'B2', language: 'en', orderIndex: 31, description: 'Phrases for business meetings', estimatedMinutes: 25, icon: '🤝' },
  { name: 'Presentations', category: 'business', cefrLevel: 'B2', language: 'en', orderIndex: 32, description: 'Giving and structuring presentations', estimatedMinutes: 35, icon: '📊' },
  { name: 'Negotiations', category: 'business', cefrLevel: 'C1', language: 'en', orderIndex: 33, description: 'Negotiation tactics and phrases', estimatedMinutes: 40, icon: '🔑' },

  // Conversation
  { name: 'Small Talk', category: 'conversation', cefrLevel: 'A2', language: 'en', orderIndex: 40, description: 'Casual conversation starters', estimatedMinutes: 15, icon: '😊' },
  { name: 'Expressing Opinions', category: 'conversation', cefrLevel: 'B1', language: 'en', orderIndex: 41, description: 'How to agree, disagree, and discuss', estimatedMinutes: 20, icon: '🗣️' },
  { name: 'Storytelling', category: 'conversation', cefrLevel: 'B2', language: 'en', orderIndex: 42, description: 'Narrative techniques and time markers', estimatedMinutes: 25, icon: '📚' },
];

async function seed() {
  await dataSource.initialize();
  console.log('✅ Database connected');

  const topicRepo = dataSource.getRepository(TopicEntity);

  for (const topic of TOPICS) {
    const exists = await topicRepo.findOne({ where: { name: topic.name, language: topic.language } });
    if (!exists) {
      await topicRepo.save(topicRepo.create({ ...topic, isActive: true }));
      console.log(`  → Added: ${topic.name}`);
    }
  }

  // Create test user
  const userRepo = dataSource.getRepository(UserEntity);
  const testExists = await userRepo.findOne({ where: { email: 'test@langlearn.dev' } });
  if (!testExists) {
    await userRepo.save(userRepo.create({
      firebaseUid: 'test-user-uid',
      email: 'test@langlearn.dev',
      name: 'Test User',
      language: 'en',
      cefrLevel: 'B1',
      isTestUser: true,
      isSubscribed: true,
      trialEndsAt: new Date('2099-12-31'),
    }));
    console.log('  → Test user created: test@langlearn.dev');
  }

  console.log('🌱 Seed complete');
  await dataSource.destroy();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
