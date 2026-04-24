import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { WordEntity } from '../../domain/entities/word.entity';
import { UserEntity } from '../../domain/entities/user.entity';
import { NotificationEntity } from '../../domain/entities/notification.entity';
import { UserSeenWordEntity } from '../../domain/entities/user-seen-word.entity';
import { FcmNotificationService } from '../../infrastructure/notifications/fcm-notification.service';
import { WordNotificationScheduler } from './word-notification.scheduler';
import { WordQueueService } from './word-queue.service';
import { WordBoosterProducer, WORD_BOOSTER_QUEUE } from './word-booster.producer';
import { WordBoosterConsumer } from './word-booster.consumer';
import { NotificationsController } from '../../presentation/controllers/notifications.controller';
import { UserNotificationsController } from '../../presentation/controllers/user-notifications.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WordEntity,
      UserEntity,
      NotificationEntity,
      UserSeenWordEntity,
    ]),
    BullModule.registerQueue({ name: WORD_BOOSTER_QUEUE }),
    AuthModule,
  ],
  providers: [
    FcmNotificationService,
    WordQueueService,
    WordBoosterProducer,
    WordBoosterConsumer,
    WordNotificationScheduler,
  ],
  controllers: [NotificationsController, UserNotificationsController],
  exports: [FcmNotificationService],
})
export class NotificationsModule {}
