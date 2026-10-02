import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import type { ReadingQuestion } from './reading-activity.entity';

/**
 * Shared pool of AI-generated reading passages. A passage is generated once and
 * then served to every learner with the same (level, interest, UI language) who
 * has not read it yet, so AI cost does not grow with the number of users.
 */
@Entity('reading_passages')
@Index(['cefrLevel', 'interest', 'language'])
export class ReadingPassageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'cefr_level' })
  cefrLevel: string;

  @Column()
  interest: string;

  /** UI language of title, topic label and explanations ('tr' | 'en'). */
  @Column({ length: 2 })
  language: string;

  @Column({ name: 'topic_label' })
  topicLabel: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'simple-array', name: 'highlighted_words', nullable: true })
  highlightedWords: string[];

  @Column({ type: 'jsonb' })
  questions: ReadingQuestion[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
