import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SubscriptionEntity,
  SubscriptionPlan,
  SubscriptionPlatform,
  SubscriptionStatus,
} from '../../../domain/entities/subscription.entity';
import { UserEntity } from '../../../domain/entities/user.entity';

export interface MockCheckoutResult {
  plan: SubscriptionPlan;
  expiresAt: Date;
  daysRemaining: number;
}

const PLAN_DAYS: Record<string, number> = {
  [SubscriptionPlan.PRO_MONTHLY]: 30,
  [SubscriptionPlan.PRO_YEARLY]: 365,
};

/** Temporary: activates Pro without a real payment until IAP is wired up. */
@Injectable()
export class MockCheckoutUseCase {
  private readonly logger = new Logger(MockCheckoutUseCase.name);

  constructor(
    @InjectRepository(SubscriptionEntity)
    private readonly subRepo: Repository<SubscriptionEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly configService: ConfigService,
  ) {}

  async execute(planId: string, user: UserEntity): Promise<MockCheckoutResult> {
    if (this.configService.get('MOCK_CHECKOUT_ENABLED') === 'false') {
      throw new ForbiddenException('Mock checkout is disabled');
    }

    const plan = planId === SubscriptionPlan.PRO_YEARLY ? SubscriptionPlan.PRO_YEARLY : SubscriptionPlan.PRO_MONTHLY;
    const days = PLAN_DAYS[plan];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + days * 86400000);

    const sub = (await this.subRepo.findOne({ where: { userId: user.id } })) ?? this.subRepo.create({ userId: user.id });
    Object.assign(sub, {
      plan,
      platform: SubscriptionPlatform.MOCK,
      status: SubscriptionStatus.ACTIVE,
      isActive: true,
      productId: `mock.${plan}`,
      startDate: now,
      endDate: expiresAt,
      expiresAt,
    });
    await this.subRepo.save(sub);
    await this.userRepo.update(user.id, { isSubscribed: true });

    this.logger.log(`Mock checkout: user ${user.id} → ${plan} until ${expiresAt.toISOString()}`);
    return { plan, expiresAt, daysRemaining: days };
  }
}
