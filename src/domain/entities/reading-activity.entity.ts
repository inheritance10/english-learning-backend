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
 * Question types supported in a reading activity.
 * - 'true-false' → opts.length === 2 (True / False)
 * - 'multi'      → opts.length 3-4
 */
export type ReadingQuestionType = 'true-false' | 'multi';

export interface ReadingQuestion {
  /** Stable id (used as React key on the client). */
  id: string;
  type: ReadingQuestionType;
  question: string;
  options: string[];
  /** Index into `options`. */
  correctIndex: number;
  /** Brief explanation in user's UI language. */
  explanation?: string;
}

/**
 * One personalized reading activity generated for the user from
 * their (skill = reading, interest = X) selection.
 *
 * The full reading body + comprehension questions are generated
 * by Gemini and persisted so the user can resume / re-open.
 */
@Entity('reading_activities')
@Index(['userId', 'createdAt'])
export class ReadingActivityEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  /** CEFR level the activity was generated for: A1..C2 */
  @Column({ name: 'cefr_level' })
  cefrLevel: string;

  /** Selected interest id, e.g. 'technology' | 'travel' | 'business' */
  @Column()
  interest: string;

  /** Display label of the topic e.g. "TEKNOLOJİ" / "TECHNOLOGY" */
  @Column({ name: 'topic_label' })
  topicLabel: string;

  /** Reading headline e.g. "Yapay Zeka ve Gelecek" */
  @Column()
  title: string;

  /** Full reading body (paragraphs separated by \n\n). */
  @Column({ type: 'text' })
  content: string;

  /**
   * Words from the body that should be visually highlighted /
   * tappable in the UI (key vocabulary at the user's level).
   */
  @Column({ type: 'simple-array', name: 'highlighted_words', nullable: true })
  highlightedWords: string[];

  /** Comprehension questions stored as JSON. */
  @Column({ type: 'jsonb' })
  questions: ReadingQuestion[];

  @Column({ name: 'is_completed', default: false })
  isCompleted: boolean;

  /** Number of correctly-answered questions on the latest submission. */
  @Column({ type: 'int', default: 0 })
  score: number;

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
