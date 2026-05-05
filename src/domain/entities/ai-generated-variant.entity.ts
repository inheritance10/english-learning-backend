import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { QuestionEntity } from './question.entity';

@Entity('ai_generated_variants')
@Index(['originalQuestionId'])
export class AiGeneratedVariantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'original_question_id' })
  originalQuestionId: string;

  @Column('text')
  content: string;

  @Column({ type: 'jsonb' })
  options: string[];

  @Column({ name: 'correct_index' })
  correctIndex: number;

  @Column('text', { nullable: true })
  explanation: string;

  @ManyToOne(() => QuestionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'original_question_id' })
  originalQuestion: QuestionEntity;

  @CreateDateColumn()
  createdAt: Date;
}
