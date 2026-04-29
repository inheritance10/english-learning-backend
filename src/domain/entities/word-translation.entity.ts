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

@Entity('word_translations')
@Unique(['wordId', 'language'])
@Index(['wordId', 'language'])
export class WordTranslationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'word_id' })
  wordId: string;

  @ManyToOne(() => WordEntity, (word) => word.translations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'word_id' })
  word: WordEntity;

  /** ISO 639-1 language code: 'tr' | 'fr' | 'de' | 'es' | 'ar' | 'en' */
  @Column({ length: 10 })
  language: string;

  @Column()
  meaning: string;

  @Column({ nullable: true })
  exampleSentence: string;

  @CreateDateColumn()
  createdAt: Date;
}
