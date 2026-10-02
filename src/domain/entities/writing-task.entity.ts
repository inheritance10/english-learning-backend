import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type WritingMode = 'build' | 'chat' | 'story' | 'translate';

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

export type WritingTask = BuildTask | ChatTask | StoryTask;

/**
 * Shared pool of AI-generated writing prompts. A task is generated once and
 * served to every learner with the same (mode, level, interest, language) who
 * has not done it yet.
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

  @Column()
  title: string;

  @Column({ type: 'jsonb' })
  task: WritingTask;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
