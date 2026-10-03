import type { RewardKey } from '../../domain/entities/reward-purchase.entity';

export interface RewardDefinition {
  key: RewardKey;
  cost: number;
  /** Max purchases per UTC day (extra activities); undefined = no daily cap. */
  dailyCap?: number;
}

/** What free users can buy with tokens. Prices are tuned so ~1 day of activity buys an extra activity. */
export const REWARDS: Record<RewardKey, RewardDefinition> = {
  extra_reading: { key: 'extra_reading', cost: 30, dailyCap: 5 },
  extra_writing: { key: 'extra_writing', cost: 30, dailyCap: 5 },
  pro_day: { key: 'pro_day', cost: 300 },
};

export const PRO_DAY_MS = 24 * 60 * 60 * 1000;

export function startOfUtcDay(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
