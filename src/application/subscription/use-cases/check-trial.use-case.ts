import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionEntity } from '../../../domain/entities/subscription.entity';
import { UserEntity } from '../../../domain/entities/user.entity';

@Injectable()
export class CheckTrialUseCase {
  constructor(
    @InjectRepository(SubscriptionEntity)
    private readonly subRepo: Repository<SubscriptionEntity>,
  ) {}

  async execute(user: UserEntity) {
    const now = new Date();

    // Test users always have access
    if (user.isTestUser) {
      return { hasAccess: true, reason: 'test_user', daysRemaining: 999 };
    }

    // Active subscription
    if (user.isSubscribed) {
      const sub = await this.subRepo.findOne({ where: { userId: user.id, isActive: true } });
      if (sub && sub.expiresAt > now) {
        const daysRemaining = Math.ceil((sub.expiresAt.getTime() - now.getTime()) / 86400000);
        return { hasAccess: true, reason: 'subscribed', plan: sub.plan, daysRemaining };
      }
    }

    // Trial period
    if (user.trialEndsAt && user.trialEndsAt > now) {
      const daysRemaining = Math.ceil((user.trialEndsAt.getTime() - now.getTime()) / 86400000);
      return { hasAccess: true, reason: 'trial', daysRemaining };
    }

    // No access
    return { hasAccess: false, reason: 'no_subscription', daysRemaining: 0 };
  }
}
