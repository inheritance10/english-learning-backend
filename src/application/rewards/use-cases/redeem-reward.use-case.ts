import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserEntity } from '../../../domain/entities/user.entity';
import type { RewardKey } from '../../../domain/entities/reward-purchase.entity';
import { CheckTrialUseCase } from '../../subscription/use-cases/check-trial.use-case';
import { PRO_DAY_MS, REWARDS, startOfUtcDay } from '../rewards.catalog';

@Injectable()
export class RedeemRewardUseCase {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly checkTrial: CheckTrialUseCase,
  ) {}

  async execute(key: string, user: UserEntity): Promise<{ balance: number }> {
    const reward = REWARDS[key as RewardKey];
    if (!reward) throw new NotFoundException('Unknown reward');

    const access = await this.checkTrial.execute(user);
    if (access.hasAccess && (access.reason !== 'reward' || reward.key !== 'pro_day')) {
      throw new BadRequestException({ code: 'ALREADY_FULL_ACCESS', message: 'You already have full access' });
    }

    return this.db.transaction(async tx => {
      // Lock the user row so concurrent redeems can't both pass the cap / balance checks
      await tx.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [user.id]);

      if (reward.dailyCap !== undefined) {
        const [{ n }] = await tx.query(
          `SELECT COUNT(*)::int AS n FROM reward_purchases WHERE user_id = $1 AND reward = $2 AND created_at >= $3`,
          [user.id, reward.key, startOfUtcDay()],
        );
        if (n >= reward.dailyCap) {
          throw new BadRequestException({ code: 'DAILY_CAP', message: 'Daily limit for this reward reached' });
        }
      }

      // Postgres UPDATE via query() resolves to [rows, affectedCount]
      const [, affected] = await tx.query(
        `UPDATE users SET "totalTokens" = "totalTokens" - $2 WHERE id = $1 AND "totalTokens" >= $2`,
        [user.id, reward.cost],
      );
      if (!affected) {
        throw new BadRequestException({ code: 'NOT_ENOUGH_TOKENS', message: 'Not enough tokens' });
      }

      if (reward.key === 'pro_day') {
        // Stack on top of any remaining reward time
        await tx.query(
          `UPDATE users SET "rewardAccessUntil" = GREATEST(COALESCE("rewardAccessUntil", now()), now()) + ($2 || ' milliseconds')::interval WHERE id = $1`,
          [user.id, PRO_DAY_MS],
        );
      }

      await tx.query(`INSERT INTO reward_purchases (user_id, reward, cost) VALUES ($1, $2, $3)`, [
        user.id,
        reward.key,
        reward.cost,
      ]);

      const [{ totalTokens }] = await tx.query(`SELECT "totalTokens" FROM users WHERE id = $1`, [user.id]);
      return { balance: Number(totalTokens) };
    });
  }
}
