import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { TopicEntity } from './topic.entity';

export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  FILL_IN_BLANK = 'fill_in_blank',
  SENTENCE_ORDER = 'sentence_order',
}

@Entity('quiz_questions')
export class QuizQuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TopicEntity, { nullable: true })
  topic: TopicEntity;

  @Column({ nullable: true })
  topicId: string;

  @Column({ type: 'enum', enum: QuestionType, default: QuestionType.MULTIPLE_CHOICE })
  type: QuestionType;

  @Column('text')
  questionText: string;

  @Column({ type: 'simple-array' })
  options: string[];

  @Column()
  correctAnswer: string;

  @Column('text', { nullable: true })
  explanationEn: string;

  @Column('text', { nullable: true })
  explanationTr: string;

  @Column({ nullable: true })
  userHobbyContext: string;

  @Column({ default: false })
  isAiGenerated: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
