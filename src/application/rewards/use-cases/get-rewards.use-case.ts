import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserEntity } from '../../../domain/entities/user.entity';
import type { RewardKey } from '../../../domain/entities/reward-purchase.entity';
import { CheckTrialUseCase } from '../../subscription/use-cases/check-trial.use-case';
import { REWARDS, startOfUtcDay } from '../rewards.catalog';

export interface RewardsOverview {
  balance: number;
  /** Paid/trial/test users already have everything; the shop is read-only for them. */
  hasFullAccess: boolean;
  rewardAccessUntil: string | null;
  items: Array<{ key: RewardKey; cost: number; boughtToday: number; dailyCap: number | null; available: boolean }>;
}

@Injectable()
export class GetRewardsUseCase {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly checkTrial: CheckTrialUseCase,
  ) {}

  async execute(user: UserEntity): Promise<RewardsOverview> {
    const [{ balance, rewardAccessUntil }] = await this.db.query(
      `SELECT "totalTokens" AS balance, "rewardAccessUntil" FROM users WHERE id = $1`,
      [user.id],
    );
    const counts: Array<{ reward: RewardKey; n: number }> = await this.db.query(
      `SELECT reward, COUNT(*)::int AS n FROM reward_purchases WHERE user_id = $1 AND created_at >= $2 GROUP BY reward`,
      [user.id, startOfUtcDay()],
    );
    const access = await this.checkTrial.execute(user);
    const paidAccess = access.hasAccess && access.reason !== 'reward';
    const today = new Map(counts.map(c => [c.reward, c.n]));

    return {
      balance: Number(balance),
      hasFullAccess: paidAccess,
      rewardAccessUntil:
        rewardAccessUntil && new Date(rewardAccessUntil) > new Date() ? new Date(rewardAccessUntil).toISOString() : null,
      items: Object.values(REWARDS).map(r => {
        const boughtToday = today.get(r.key) ?? 0;
        const capped = r.dailyCap !== undefined && boughtToday >= r.dailyCap;
        return {
          key: r.key,
          cost: r.cost,
          boughtToday,
          dailyCap: r.dailyCap ?? null,
          // Extras are pointless while any full access is active; Pro days can be stacked
          available: (r.key === 'pro_day' ? !paidAccess : !access.hasAccess) && !capped && Number(balance) >= r.cost,
        };
      }),
    };
  }
}
