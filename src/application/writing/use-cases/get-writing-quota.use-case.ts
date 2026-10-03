import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { UserEntity } from '../../../domain/entities/user.entity';
import { WritingActivityEntity } from '../../../domain/entities/writing-activity.entity';
import { CheckTrialUseCase } from '../../subscription/use-cases/check-trial.use-case';
import { RewardPurchaseEntity } from '../../../domain/entities/reward-purchase.entity';

export const FREE_DAILY_WRITING_LIMIT = 3;

export interface WritingQuota {
  unlimited: boolean;
  limit: number;
  used: number;
  remaining: number;
}

/** Daily writing allowance. Days are counted in UTC. */
@Injectable()
export class GetWritingQuotaUseCase {
  constructor(
    @InjectRepository(WritingActivityEntity)
    private readonly repo: Repository<WritingActivityEntity>,
    private readonly checkTrial: CheckTrialUseCase,
    @InjectRepository(RewardPurchaseEntity)
    private readonly purchases: Repository<RewardPurchaseEntity>,
  ) {}

  async execute(user: UserEntity): Promise<WritingQuota> {
    const { hasAccess } = await this.checkTrial.execute(user);
    if (hasAccess) {
      return { unlimited: true, limit: FREE_DAILY_WRITING_LIMIT, used: 0, remaining: FREE_DAILY_WRITING_LIMIT };
    }

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const used = await this.repo.count({
      where: { userId: user.id, createdAt: MoreThanOrEqual(startOfDay) },
    });
    // Extra activities bought with tokens today raise today's limit
    const extras = await this.purchases.count({
      where: { userId: user.id, reward: 'extra_writing', createdAt: MoreThanOrEqual(startOfDay) },
    });
    const limit = FREE_DAILY_WRITING_LIMIT + extras;

    return {
      unlimited: false,
      limit,
      used,
      remaining: Math.max(limit - used, 0),
    };
  }
}
