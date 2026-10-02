import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export interface WordMeaning {
  partOfSpeech: string;
  /** Simple English definition. */
  definition: string;
  /** Turkish equivalent of this sense. */
  translation: string;
  exampleSentence: string;
  exampleTranslation: string;
}

/** Top-level fields mirror `meanings[0]` so older clients keep working. */
export interface WordDefinition {
  word: string;
  phonetic?: string;
  partOfSpeech: string;
  definition: string;
  translation: string;
  exampleSentence: string;
  exampleTranslation: string;
  /** The most common senses, most common first. */
  meanings?: WordMeaning[];
}

/** Cache of AI word definitions so each (word, level) is generated only once. `language` is the translation language (always 'tr'). */
@Entity('word_definitions')
@Index(['word', 'cefrLevel', 'language'], { unique: true })
export class WordDefinitionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  word: string;

  @Column({ name: 'cefr_level' })
  cefrLevel: string;

  @Column({ length: 2 })
  language: string;

  @Column({ type: 'jsonb' })
  definition: WordDefinition;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
