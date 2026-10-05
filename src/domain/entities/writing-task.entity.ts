import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type WritingMode = 'build' | 'chat' | 'story' | 'scramble' | 'translate';

/** Grammar topic an activity practises (from the topics table). */
export interface WritingFocus {
  name: string;
  example?: string;
}

/** Sentence builder: one sentence per round using the given words. */
export interface BuildTask {
  mode: 'build';
  rounds: Array<{ words: string[]; starters: string[] }>;
}

/** Role-play text chat with a character. */
export interface ChatTask {
  mode: 'chat';
  title: string;
  character: string;
  setting: string;
  goal: string;
  opener: string;
  suggestions: string[];
}

/** Write a story together: Octo and the learner take turns adding to it. */
export interface StoryTask {
  mode: 'story';
  title: string;
  genre: string;
  /** Octo's opening lines, in English. */
  opener: string;
  /** One short idea per learner turn (in the UI language) to help when stuck. */
  prompts: string[];
  /** Sentence starters per learner turn. */
  starters: string[][];
}

/** Word order game: put the shuffled words of a sentence back in order. */
export interface ScrambleTask {
  mode: 'scramble';
  rounds: Array<{
    /** Row in scramble_sentences, used to avoid showing a learner the same sentence twice. */
    id?: string;
    /** The sentence as written, e.g. "She has never been to Paris." */
    sentence: string;
    /** Its meaning in the learner's UI language. */
    hint: string;
    /** The sentence's words in the right order, as shown on the tiles (no final punctuation). */
    words: string[];
    /** Final punctuation shown after the last tile ("." / "?" / "!"). */
    end: string;
  }>;
}

export type WritingTask = BuildTask | ChatTask | StoryTask | ScrambleTask;

/**
 * Shared pool of AI-generated writing prompts. A task is generated once and
 * served to every learner with the same (mode, level, interest, topic, language)
 * who has not done it yet.
 */
@Entity('writing_tasks')
@Index(['mode', 'cefrLevel', 'interest', 'language'])
export class WritingTaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  mode: WritingMode;

  @Column({ name: 'cefr_level' })
  cefrLevel: string;

  @Column()
  interest: string;

  @Column({ length: 2 })
  language: string;

  /** Grammar topic the task practises; null for free practice. */
  @Index()
  @Column({ name: 'topic_id', type: 'uuid', nullable: true })
  topicId: string | null;

  @Column()
  title: string;

  @Column({ type: 'jsonb' })
  task: WritingTask;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
