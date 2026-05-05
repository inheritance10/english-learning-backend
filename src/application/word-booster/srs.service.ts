import { Injectable } from '@nestjs/common';

/**
 * SRS interval schedule (interval_level → minutes until next review):
 *  0 → 10 min
 *  1 → 60 min (1 hr)
 *  2 → 1440 min (1 day)
 *  3 → 4320 min (3 days)
 *  4 → 10080 min (1 week — Reminder Test)
 *  5+ → mastered (no re-schedule)
 */
const SRS_INTERVALS_MINUTES: Record<number, number> = {
  0: 10,
  1: 60,
  2: 1440,
  3: 4320,
  4: 10080,
};

@Injectable()
export class SrsService {
  readonly MASTERED_LEVEL = 5;

  /**
   * Calculate the next review date for a "known" (swiped right) word.
   * Increases interval level and returns when to review again.
   */
  computeNextReviewForKnown(currentLevel: number): { nextLevel: number; nextReviewAt: Date | null } {
    const nextLevel = currentLevel + 1;

    if (nextLevel >= this.MASTERED_LEVEL) {
      // Word is mastered — no further scheduling
      return { nextLevel, nextReviewAt: null };
    }

    const minutes = SRS_INTERVALS_MINUTES[nextLevel] ?? 10080;
    return { nextLevel, nextReviewAt: this.addMinutes(minutes) };
  }

  /**
   * For an "unknown" (swiped left) word, return the 3 retry delays in ms.
   * These are added as separate BullMQ jobs.
   */
  getRetryDelaysMs(): number[] {
    return [
      SRS_INTERVALS_MINUTES[0] * 60 * 1000,  // 10 min
      SRS_INTERVALS_MINUTES[1] * 60 * 1000,  // 1 hr
      SRS_INTERVALS_MINUTES[2] * 60 * 1000,  // 1 day
    ];
  }

  /**
   * Update ease factor (simplified SM-2).
   * easeFactor decreases when forgotten, slight increase when known.
   */
  updateEaseFactor(current: number, remembered: boolean): number {
    const delta = remembered ? 0.1 : -0.2;
    return Math.max(1.3, Math.min(3.0, current + delta));
  }

  isMastered(intervalLevel: number): boolean {
    return intervalLevel >= this.MASTERED_LEVEL;
  }

  private addMinutes(minutes: number): Date {
    return new Date(Date.now() + minutes * 60 * 1000);
  }
}
