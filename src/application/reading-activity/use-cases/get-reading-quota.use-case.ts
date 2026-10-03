import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { UserEntity } from '../../../domain/entities/user.entity';
import { ReadingActivityEntity } from '../../../domain/entities/reading-activity.entity';
import { CheckTrialUseCase } from '../../subscription/use-cases/check-trial.use-case';
import { RewardPurchaseEntity } from '../../../domain/entities/reward-purchase.entity';

export const FREE_DAILY_READING_LIMIT = 3;

export interface ReadingQuota {
  unlimited: boolean;
  limit: number;
  used: number;
  remaining: number;
}

/** Daily reading allowance. Days are counted in UTC. */
@Injectable()
export class GetReadingQuotaUseCase {
  constructor(
    @InjectRepository(ReadingActivityEntity)
    private readonly repo: Repository<ReadingActivityEntity>,
    private readonly checkTrial: CheckTrialUseCase,
    @InjectRepository(RewardPurchaseEntity)
    private readonly purchases: Repository<RewardPurchaseEntity>,
  ) {}

  async execute(user: UserEntity): Promise<ReadingQuota> {
    const { hasAccess } = await this.checkTrial.execute(user);
    if (hasAccess) {
      return { unlimited: true, limit: FREE_DAILY_READING_LIMIT, used: 0, remaining: FREE_DAILY_READING_LIMIT };
    }

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const used = await this.repo.count({
      where: { userId: user.id, createdAt: MoreThanOrEqual(startOfDay) },
    });
    // Extra activities bought with tokens today raise today's limit
    const extras = await this.purchases.count({
      where: { userId: user.id, reward: 'extra_reading', createdAt: MoreThanOrEqual(startOfDay) },
    });
    const limit = FREE_DAILY_READING_LIMIT + extras;

    return {
      unlimited: false,
      limit,
      used,
      remaining: Math.max(limit - used, 0),
    };
  }
}
