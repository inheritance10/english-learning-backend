import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from './application/auth/auth.module';
import { TopicsModule } from './application/topics/topics.module';
import { AiModule } from './application/ai/ai.module';
import { SubscriptionModule } from './application/subscription/subscription.module';
import { ProgressModule } from './application/progress/progress.module';
import { VocabularyModule } from './application/vocabulary/vocabulary.module';
import { NotificationsModule } from './application/notifications/notifications.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { UserEntity } from './domain/entities/user.entity';
import { TopicEntity } from './domain/entities/topic.entity';
import { QuizQuestionEntity } from './domain/entities/quiz-question.entity';
import { SubscriptionEntity } from './domain/entities/subscription.entity';
import { VocabularyItemEntity } from './domain/entities/vocabulary-item.entity';
import { UserProgressEntity } from './domain/entities/user-progress.entity';
import { DailyStreakEntity } from './domain/entities/daily-streak.entity';
import { WordEntity } from './domain/entities/word.entity';
import { NotificationEntity } from './domain/entities/notification.entity';
import { UserSeenWordEntity } from './domain/entities/user-seen-word.entity';
import { UserCompletedTopicEntity } from './domain/entities/user-completed-topic.entity';
import { WordTranslationEntity } from './domain/entities/word-translation.entity';
import { UserWordSrsEntity } from './domain/entities/user-word-srs.entity';
import { StoryEntity } from './domain/entities/story.entity';
import { ReadingPassageEntity } from './domain/entities/reading-passage.entity';
import { WordDefinitionEntity } from './domain/entities/word-definition.entity';
import { QuizAnswerExplanationEntity } from './domain/entities/quiz-answer-explanation.entity';
import { FeedbackEntity } from './domain/entities/feedback.entity';
import { FeedbackModule } from './application/feedback/feedback.module';
import { RewardsModule } from './application/rewards/rewards.module';
import { RewardPurchaseEntity } from './domain/entities/reward-purchase.entity';
import { AiUsageLogEntity } from './domain/entities/ai-usage-log.entity';
import { JobRunEntity } from './domain/entities/job-run.entity';
import { ApiErrorEntity } from './domain/entities/api-error.entity';
import { AllExceptionsFilter } from './infrastructure/errors/all-exceptions.filter';
import { APP_FILTER } from '@nestjs/core';
import { ObservabilityModule } from './infrastructure/observability/observability.module';
import { AdminModule } from './application/admin/admin.module';
import { WritingTaskEntity } from './domain/entities/writing-task.entity';
import { WordBoosterModule } from './application/word-booster/word-booster.module';
import { ExamPrepModule } from './application/exam-prep/exam-prep.module';
import { ExamEntity } from './domain/entities/exam.entity';
import { ExamCategoryEntity } from './domain/entities/exam-category.entity';
import { QuestionEntity } from './domain/entities/question.entity';
import { UserExamAttemptEntity } from './domain/entities/user-exam-attempt.entity';
import { AiGeneratedVariantEntity } from './domain/entities/ai-generated-variant.entity';
import { ReadingActivityEntity } from './domain/entities/reading-activity.entity';
import { ReadingActivityModule } from './application/reading-activity/reading-activity.module';
import { UserSeenQuestionEntity } from './domain/entities/user-seen-question.entity';
import { QuestionPoolModule } from './application/question-pool/question-pool.module';
import { WritingActivityEntity } from './domain/entities/writing-activity.entity';
import { WritingModule } from './application/writing/writing.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get('DATABASE_URL');

        const config: any = {
          type: 'postgres',
          entities: [
            UserEntity,
            TopicEntity,
            QuizQuestionEntity,
            SubscriptionEntity,
            VocabularyItemEntity,
            UserProgressEntity,
            DailyStreakEntity,
            WordEntity,
            NotificationEntity,
            UserSeenWordEntity,
            UserCompletedTopicEntity,
            WordTranslationEntity,
            UserWordSrsEntity,
            StoryEntity,
            ExamEntity,
            ExamCategoryEntity,
            QuestionEntity,
            UserExamAttemptEntity,
            AiGeneratedVariantEntity,
            ReadingActivityEntity,
            ReadingPassageEntity,
            WordDefinitionEntity,
            QuizAnswerExplanationEntity,
            FeedbackEntity,
            RewardPurchaseEntity,
            AiUsageLogEntity,
            JobRunEntity,
            ApiErrorEntity,
            UserSeenQuestionEntity,
            WritingActivityEntity,
            WritingTaskEntity,
          ],
          synchronize: configService.get('NODE_ENV') !== 'production' || configService.get('FORCE_SYNC') === 'true',
          logging: configService.get('NODE_ENV') === 'development',
        };

        if (databaseUrl) {
          config.url = databaseUrl;
        } else {
          config.host = configService.get('DB_HOST', 'localhost');
          config.port = configService.get<number>('DB_PORT', 5432);
          config.username = configService.get('DB_USERNAME', 'postgres');
          config.password = configService.get('DB_PASSWORD', 'postgres');
          config.database = configService.get('DB_NAME', 'langlearndb');
        }

        return config;
      },
      inject: [ConfigService],
    }),

    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),

    // BullMQ — global Redis connection for all queues
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
        },
      }),
      inject: [ConfigService],
    }),

    // Redis (global — available to all modules)
    RedisModule,
    ObservabilityModule,
    AdminModule,

    AuthModule,
    TopicsModule,
    AiModule,
    SubscriptionModule,
    ProgressModule,
    VocabularyModule,
    NotificationsModule,
    WordBoosterModule,
    ExamPrepModule,
    ReadingActivityModule,
    QuestionPoolModule,
    WritingModule,
    FeedbackModule,
    RewardsModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
