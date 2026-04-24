import { Controller, Post, Body, Get, Patch, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsIn, Matches } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UserEntity } from '../../domain/entities/user.entity';
import { FcmNotificationService } from '../../infrastructure/notifications/fcm-notification.service';
import { WordNotificationScheduler } from '../../application/notifications/word-notification.scheduler';
import { WORD_COUNT_OPTIONS, FREQUENCY_OPTIONS } from '../../domain/constants/word-booster.constants';

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const WORD_COUNTS = WORD_COUNT_OPTIONS;
const FREQUENCIES = Object.keys(FREQUENCY_OPTIONS) as Array<keyof typeof FREQUENCY_OPTIONS>;

class UpdateNotificationPrefsDto {
  @IsOptional()
  @IsBoolean()
  isWordNotificationEnabled?: boolean;

  @IsOptional()
  @IsIn(CEFR_LEVELS)
  notificationLevel?: string;

  @IsOptional()
  @IsIn(WORD_COUNTS)
  wordNotificationCount?: number;

  @IsOptional()
  @IsIn(FREQUENCIES)
  wordNotificationFrequency?: string;

  /** 'HH:mm' format, e.g. "23:00" */
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'quietHoursStart must be HH:mm' })
  quietHoursStart?: string;

  /** 'HH:mm' format, e.g. "08:00" */
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'quietHoursEnd must be HH:mm' })
  quietHoursEnd?: string;

  /** Firebase Cloud Messaging device token */
  @IsOptional()
  @IsString()
  fcmToken?: string;
}

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly fcmService: FcmNotificationService,
    private readonly scheduler: WordNotificationScheduler,
  ) {}

  @Get('prefs')
  @ApiOperation({ summary: 'Get current notification preferences' })
  async getPrefs(@CurrentUser() user: UserEntity) {
    return {
      isWordNotificationEnabled: user.isWordNotificationEnabled,
      notificationLevel: user.notificationLevel ?? user.cefrLevel,
      wordNotificationCount: user.wordNotificationCount,
      wordNotificationFrequency: user.wordNotificationFrequency,
      quietHoursStart: user.quietHoursStart,
      quietHoursEnd: user.quietHoursEnd,
      hasFcmToken: !!user.fcmToken,
    };
  }

  @Patch('prefs')
  @ApiOperation({ summary: 'Update word booster notification preferences' })
  async updatePrefs(
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateNotificationPrefsDto,
  ) {
    const prevEnabled = user.isWordNotificationEnabled;
    const prevLevel = user.notificationLevel ?? user.cefrLevel;

    // Apply changes
    if (dto.isWordNotificationEnabled !== undefined) user.isWordNotificationEnabled = dto.isWordNotificationEnabled;
    if (dto.notificationLevel) user.notificationLevel = dto.notificationLevel;
    if (dto.wordNotificationCount !== undefined) user.wordNotificationCount = dto.wordNotificationCount;
    if (dto.wordNotificationFrequency) user.wordNotificationFrequency = dto.wordNotificationFrequency;
    if (dto.quietHoursStart !== undefined) user.quietHoursStart = dto.quietHoursStart;
    if (dto.quietHoursEnd !== undefined) user.quietHoursEnd = dto.quietHoursEnd;
    if (dto.fcmToken) user.fcmToken = dto.fcmToken;

    await this.userRepo.save(user);

    // If FCM token present, manage topic subscription server-side
    if (user.fcmToken) {
      const currentLevel = user.notificationLevel ?? user.cefrLevel;
      const topic = `word_booster_${currentLevel?.toLowerCase()}`;
      const prevTopic = `word_booster_${prevLevel?.toLowerCase()}`;

      if (user.isWordNotificationEnabled) {
        // Unsubscribe from old topic if level changed
        if (prevLevel !== currentLevel && prevEnabled) {
          await this.fcmService.unsubscribeFromTopic(user.fcmToken, prevTopic);
        }
        await this.fcmService.subscribeToTopic(user.fcmToken, topic);
      } else if (prevEnabled && !user.isWordNotificationEnabled) {
        await this.fcmService.unsubscribeFromTopic(user.fcmToken, prevTopic);
      }
    }

    return {
      isWordNotificationEnabled: user.isWordNotificationEnabled,
      notificationLevel: user.notificationLevel ?? user.cefrLevel,
      wordNotificationCount: user.wordNotificationCount,
      wordNotificationFrequency: user.wordNotificationFrequency,
      quietHoursStart: user.quietHoursStart,
      quietHoursEnd: user.quietHoursEnd,
    };
  }

  /** Dev/admin: immediately reschedule today's word jobs for current user */
  @Post('test-send')
  @HttpCode(200)
  @ApiOperation({ summary: '[Dev] Reschedule today\'s Word Booster jobs for current user' })
  async testSend(@CurrentUser() user: UserEntity) {
    await this.scheduler.rescheduleUser(user.id);
    return { triggered: true, userId: user.id };
  }
}
