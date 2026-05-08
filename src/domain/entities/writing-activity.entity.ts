import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from './user.entity';

/**
 * All supported writing activity formats.
 * Stored as a varchar column with default 'mail' for backward compat.
 */
export type WritingActivityType =
  | 'mail'      // Reply to an email
  | 'picture'   // Describe a scene / picture
  | 'social'    // Write a tweet / Instagram caption
  | 'chat'      // Complete a chat dialogue
  | 'journal'   // Daily journaling prompt
  | 'whatif';   // Creative "What if…?" scenario

/** AI correction payload returned by Gemini and stored as JSONB. */
export interface WritingCorrection {
  /** The user's original text (trimmed). */
  original: string;
  /** Naturally rewritten / improved version by Octo. */
  improved: string;
  /** One-sentence native-speaker pro-tip about style/register. */
  proTip: string;
  /**
   * Key phrases (sub-strings) that appear in `improved` and represent
   * meaningful upgrades compared to the original.
   * Used by the UI to render green highlights in the improved text.
   */
  highlightedPhrases: string[];
}

/**
 * One writing activity session:
 * - Gemini generates a scenario + inbox mail to reply to.
 * - User writes a response; submits for AI correction.
 * - Correction is stored and displayed as "Your version vs Octo's suggestion".
 */
@Entity('writing_activities')
@Index(['userId', 'createdAt'])
export class WritingActivityEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  /** CEFR level this activity was generated for. */
  @Column({ name: 'cefr_level' })
  cefrLevel: string;

  /** Broad interest e.g. 'business' | 'travel' | 'technology'. */
  @Column()
  interest: string;

  /** Writing activity type. Default 'mail' for backward compatibility. */
  @Column({ name: 'activity_type', default: 'mail' })
  activityType: WritingActivityType;

  /** Short description of the writing task shown to the user. */
  @Column({ type: 'text' })
  scenario: string;

  /** The "received email" body that the user must reply to. */
  @Column({ name: 'received_mail', type: 'text' })
  receivedMail: string;

  /**
   * 3 checklist items the user should address in their reply
   * e.g. ["Confirm the time", "Ask for the location", "Thank the sender"]
   */
  @Column({ type: 'simple-array', name: 'key_points' })
  keyPoints: string[];

  /** Sentence-starter hint shown when user taps the Hint button. */
  @Column({ name: 'initial_hint', type: 'text', nullable: true })
  initialHint: string | null;

  /** The reply the user wrote (null until submitted). */
  @Column({ name: 'user_text', type: 'text', nullable: true })
  userText: string | null;

  /** AI correction; null until user submits. */
  @Column({ type: 'jsonb', name: 'ai_correction', nullable: true })
  aiCorrection: WritingCorrection | null;

  @Column({ name: 'is_completed', default: false })
  isCompleted: boolean;

  @Column({ name: 'tokens_earned', type: 'int', default: 0 })
  tokensEarned: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
