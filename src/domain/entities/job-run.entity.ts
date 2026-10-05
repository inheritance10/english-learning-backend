import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** One row per background run: a queue job or a cron tick. */
@Entity('job_runs')
@Index(['startedAt'])
@Index(['name', 'startedAt'])
export class JobRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** e.g. "question-pool:fill-topic-pool", "cron:question-pool.ensureBaseline" */
  @Column({ length: 120 })
  name: string;

  @Column({ length: 10 })
  kind: 'queue' | 'cron';

  @Column({ length: 10 })
  status: 'ok' | 'failed';

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'duration_ms', type: 'int', default: 0 })
  durationMs: number;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  /** Small summary, e.g. how many questions were queued or saved. */
  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
