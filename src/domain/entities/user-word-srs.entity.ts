import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { WordEntity } from './word.entity';
import { UserEntity } from './user.entity';

/**
 * Spaced Repetition System (SRS) tracking per user per word.
 * Created/updated when the user swipes on a Word Booster card.
 *
 * Interval schedule:
 *  level 0 → +10 min
 *  level 1 → +1 hr
 *  level 2 → +1 day
 *  level 3 → +3 days
 *  level 4 → +1 week (Reminder test)
 *  level 5+ → "Mastered" — no further re-scheduling
 */
@Entity('user_word_srs')
@Unique(['userId', 'wordId'])
@Index(['userId', 'nextReviewAt'])
export class UserWordSrsEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'word_id' })
  wordId: string;

  /**
   * 'unseen'  — word exists in SRS table but hasn't been swiped yet (pre-created)
   * 'known'   — user swiped right (knows the word)
   * 'unknown' — user swiped left (doesn't know the word)
   * 'mastered' — passed all intervals, no more re-scheduling
   */
  @Column({ default: 'unknown' })
  status: 'unseen' | 'known' | 'unknown' | 'mastered';

  /**
   * Current SRS interval level (0–5).
   * Increases on correct swipe, resets to 0 on incorrect.
   */
  @Column({ name: 'interval_level', default: 0 })
  intervalLevel: number;

  /**
   * SM-2 ease factor (default 2.5).
   * Decreases when word is forgotten, increases when remembered.
   */
  @Column({ name: 'ease_factor', type: 'float', default: 2.5 })
  easeFactor: number;

  /**
   * When this word should next appear in the swipe deck.
   * null = immediately available.
   */
  @Column({ name: 'next_review_at', nullable: true, type: 'timestamptz' })
  nextReviewAt: Date | null;

  /** Total number of times this word has been reviewed */
  @Column({ name: 'review_count', default: 0 })
  reviewCount: number;

  @Column({ name: 'last_reviewed_at', nullable: true, type: 'timestamptz' })
  lastReviewedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => WordEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'word_id' })
  word: WordEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
