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
          ],
          synchronize: configService.get('NODE_ENV') !== 'production',
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

    AuthModule,
    TopicsModule,
    AiModule,
    SubscriptionModule,
    ProgressModule,
    VocabularyModule,
    NotificationsModule,
  ],
})
export class AppModule {}
