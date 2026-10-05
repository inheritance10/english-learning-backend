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
import type { WritingMode, WritingTask } from './writing-task.entity';

export interface WritingCorrection {
  wrong: string;
  right: string;
  /** One short explanation in the learner's UI language. */
  note: string;
}

export interface WritingTurn {
  userText: string;
  /** True when the text is correct and does what the task asked. */
  ok: boolean;
  corrected: string;
  corrections: WritingCorrection[];
  /** A more natural way to say it; omitted when the text is already natural. */
  natural?: string;
  /** Chat / story: the partner's next line. */
  reply?: string;
  /** Chat / story: suggested starters for the learner's next message. */
  suggestions?: string[];
  /** Story: a short idea (UI language) for what the learner could write next. */
  idea?: string;
}

@Entity('writing_activities')
@Index(['userId', 'createdAt'])
export class WritingActivityEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Index()
  @Column({ name: 'task_id', type: 'uuid', nullable: true })
  taskId: string | null;

  @Column({ name: 'cefr_level' })
  cefrLevel: string;

  @Column()
  interest: string;

  /** Grammar topic being practised; null for free practice. */
  @Column({ name: 'topic_id', type: 'uuid', nullable: true })
  topicId: string | null;

  /** Topic name in the learner's UI language, kept for headers and history. */
  @Column({ name: 'topic_name', type: 'text', nullable: true })
  topicName: string | null;

  @Column({ name: 'activity_type', default: 'build' })
  mode: WritingMode;

  /** Short title shown in lists and activity history. */
  @Column({ type: 'text' })
  scenario: string;

  @Column({ type: 'jsonb', nullable: true })
  task: WritingTask | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  turns: WritingTurn[];

  @Column({ name: 'total_turns', type: 'int', default: 0 })
  totalTurns: number;

  /** Number of turns marked ok. */
  @Column({ type: 'int', default: 0 })
  score: number;

  // Columns from the retired email/journal activities, kept so older history rows survive.
  @Column({ name: 'received_mail', type: 'text', nullable: true })
  receivedMail: string | null;

  @Column({ type: 'simple-array', name: 'key_points', nullable: true })
  keyPoints: string[] | null;

  @Column({ name: 'initial_hint', type: 'text', nullable: true })
  initialHint: string | null;

  @Column({ name: 'user_text', type: 'text', nullable: true })
  userText: string | null;

  @Column({ name: 'ai_correction', type: 'jsonb', nullable: true })
  aiCorrection: unknown;

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
