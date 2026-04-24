import {
  Controller, Get, Patch, Delete,
  Param, Query, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UserEntity } from '../../domain/entities/user.entity';
import { NotificationEntity } from '../../domain/entities/notification.entity';

@ApiTags('user-notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user-notifications')
export class UserNotificationsController {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
  ) {}

  /** Kullanıcının bildirimlerini listele */
  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'unreadOnly', required: false })
  async getNotifications(
    @CurrentUser() user: UserEntity,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const take = Math.min(parseInt(limit) || 20, 50);
    const skip = (parseInt(page) - 1) * take;

    const where: any = { userId: user.id };
    if (unreadOnly === 'true') where.isRead = false;

    const [items, total] = await this.notificationRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take,
      skip,
    });

    const unreadCount = await this.notificationRepo.count({
      where: { userId: user.id, isRead: false },
    });

    return {
      items,
      total,
      unreadCount,
      page: parseInt(page),
      totalPages: Math.ceil(total / take),
    };
  }

  /** Tekil bildirimi okundu işaretle */
  @Patch(':id/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(
    @CurrentUser() user: UserEntity,
    @Param('id') id: string,
  ) {
    await this.notificationRepo.update(
      { id, userId: user.id },
      { isRead: true },
    );
    return { success: true };
  }

  /** Tüm bildirimleri okundu işaretle */
  @Patch('read-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser() user: UserEntity) {
    await this.notificationRepo.update(
      { userId: user.id, isRead: false },
      { isRead: true },
    );
    return { success: true };
  }

  /** Tekil bildirimi sil */
  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a notification' })
  async deleteOne(
    @CurrentUser() user: UserEntity,
    @Param('id') id: string,
  ) {
    await this.notificationRepo.delete({ id, userId: user.id });
    return { success: true };
  }

  /** Tüm bildirimleri sil */
  @Delete()
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete all notifications' })
  async deleteAll(@CurrentUser() user: UserEntity) {
    await this.notificationRepo.delete({ userId: user.id });
    return { success: true };
  }
}
