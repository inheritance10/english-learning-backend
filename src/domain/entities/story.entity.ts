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
 * Stores daily AI-generated stories created from words
 * the user didn't know (swiped left) that day.
 */
@Entity('word_booster_stories')
@Index(['userId', 'storyDate'], { unique: true })
export class StoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  /** Date the story is for: YYYY-MM-DD */
  @Column({ name: 'story_date' })
  storyDate: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  /** The unknown words used in this story */
  @Column({ type: 'simple-array' })
  words: string[];

  /** Words that are highlighted/tappable in the story */
  @Column({ type: 'simple-array', name: 'word_highlights', nullable: true })
  wordHighlights: string[];

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
