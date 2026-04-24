/**
 * Word Booster Constants
 * Shared constants for notification preferences and validation
 */

/** Daily word notification count options */
export const WORD_COUNT_OPTIONS = [5, 10, 20] as const;
export type WordCount = typeof WORD_COUNT_OPTIONS[number];

/** Notification frequency options in minutes */
export const FREQUENCY_OPTIONS = {
  '1m': 1,    // Dev/test only — fires every 1 minute
  '10m': 10,
  '30m': 30,
  '60m': 60,
} as const;

export type FrequencyKey = keyof typeof FREQUENCY_OPTIONS;
export type FrequencyMinutes = typeof FREQUENCY_OPTIONS[FrequencyKey];

/** Human-readable labels for frequencies */
export const FREQUENCY_LABELS: Record<FrequencyKey, string> = {
  '1m': 'Every 1 minute (dev)',
  '10m': 'Every 10 minutes',
  '30m': 'Every 30 minutes',
  '60m': 'Every hour',
} as const;

/** Daily notification window (hardcoded) */
export const NOTIFICATION_WINDOW = {
  START: '08:00',
  END: '22:00',
} as const;

/** Redis queue expiration time in seconds (24 hours) */
export const QUEUE_TTL = 86400;

/** Time tolerance for matching scheduled notifications (in minutes) */
export const SCHEDULING_TOLERANCE_MINUTES = 5;
