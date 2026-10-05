import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** One row per Gemini call: which feature asked, which model answered, and what it cost in tokens. */
@Entity('ai_usage_logs')
@Index(['createdAt'])
@Index(['feature', 'createdAt'])
export class AiUsageLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 60 })
  feature: string;

  @Column({ length: 80 })
  model: string;

  @Column({ name: 'input_tokens', type: 'int', default: 0 })
  inputTokens: number;

  @Column({ name: 'output_tokens', type: 'int', default: 0 })
  outputTokens: number;

  /** Thinking tokens are billed as output; they should stay ~0 now that thinking is off. */
  @Column({ name: 'thought_tokens', type: 'int', default: 0 })
  thoughtTokens: number;

  @Column({ name: 'duration_ms', type: 'int', default: 0 })
  durationMs: number;

  @Column({ default: true })
  ok: boolean;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
