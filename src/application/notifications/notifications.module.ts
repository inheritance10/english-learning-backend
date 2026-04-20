import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WordEntity } from '../../domain/entities/word.entity';
import { UserEntity } from '../../domain/entities/user.entity';
import { FcmNotificationService } from '../../infrastructure/notifications/fcm-notification.service';
import { WordNotificationScheduler } from './word-notification.scheduler';
import { NotificationsController } from '../../presentation/controllers/notifications.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WordEntity, UserEntity]),
    AuthModule,
  ],
  providers: [FcmNotificationService, WordNotificationScheduler],
  controllers: [NotificationsController],
  exports: [FcmNotificationService],
})
export class NotificationsModule {}
