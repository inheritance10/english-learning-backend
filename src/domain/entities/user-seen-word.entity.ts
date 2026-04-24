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
import { UserEntity } from './user.entity';
import { WordEntity } from './word.entity';

/**
 * Tracks which words have been sent to each user via Word Booster.
 * Per-user tracking — User A seeing word-X does NOT prevent User B from seeing word-X.
 */
@Entity('user_seen_words')
@Unique(['userId', 'wordId'])          // same word never sent twice to same user
@Index(['userId'])                      // fast lookup by user
export class UserSeenWordEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'word_id' })
  wordId: string;

  /** CEFR level at the time the word was seen */
  @Column({ name: 'seen_at_level', nullable: true })
  seenAtLevel: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => WordEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'word_id' })
  word: WordEntity;

  @CreateDateColumn()
  seenAt: Date;
}
