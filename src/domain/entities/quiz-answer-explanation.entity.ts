import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { QuizQuestionEntity } from './quiz-question.entity';

export interface AnswerExplanation {
  feedback: string;
  rule: string;
  example: string;
}

/**
 * AI explanation of a specific wrong option of a pool question, in one UI language.
 * Generated the first time any user picks that option, then reused for everyone.
 */
@Entity('quiz_answer_explanations')
@Index(['questionId', 'chosenIndex', 'language'], { unique: true })
export class QuizAnswerExplanationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'question_id' })
  questionId: string;

  @Column({ name: 'chosen_index', type: 'int' })
  chosenIndex: number;

  @Column({ length: 2 })
  language: string;

  @Column({ type: 'jsonb' })
  explanation: AnswerExplanation;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => QuizQuestionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question: QuizQuestionEntity;
}
