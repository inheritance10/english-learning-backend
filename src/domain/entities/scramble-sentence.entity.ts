import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Shared pool of AI-generated word order sentences. Sentences are generated in
 * batches only when a learner has seen every sentence for their
 * (level, interest, topic, language), then reused by everyone else.
 */
@Entity('scramble_sentences')
@Index(['cefrLevel', 'interest', 'language', 'topicId'])
export class ScrambleSentenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'cefr_level' })
  cefrLevel: string;

  @Column()
  interest: string;

  /** Grammar topic the sentence practises; null for free practice. */
  @Column({ name: 'topic_id', type: 'uuid', nullable: true })
  topicId: string | null;

  /** Language of the hint. */
  @Column({ length: 2 })
  language: string;

  @Column({ type: 'text' })
  sentence: string;

  /** Lowercased sentence without punctuation, used to skip duplicates. */
  @Column({ type: 'text' })
  normalized: string;

  @Column({ type: 'text' })
  hint: string;

  @Column({ type: 'jsonb' })
  words: string[];

  @Column({ length: 3 })
  end: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
