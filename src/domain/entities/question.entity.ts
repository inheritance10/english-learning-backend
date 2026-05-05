import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ExamEntity } from './exam.entity';
import { ExamCategoryEntity } from './exam-category.entity';

@Entity('questions')
@Index(['examId', 'categoryId'])
@Index(['topicTag'])
export class QuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'exam_id' })
  examId: string;

  @Column({ name: 'category_id' })
  categoryId: string;

  @Column('text')
  content: string;

  @Column({ type: 'jsonb' })
  options: string[];

  @Column({ name: 'correct_index' })
  correctIndex: number;

  @Column('text', { nullable: true })
  explanation: string;

  @Column({ name: 'difficulty_level', default: 'medium' })
  difficultyLevel: 'easy' | 'medium' | 'hard';

  @Column({ name: 'topic_tag', nullable: true })
  topicTag: string;

  @Column({ name: 'is_original', default: true })
  isOriginal: boolean;

  @Column({ name: 'wrong_count', default: 0 })
  wrongCount: number;

  @ManyToOne(() => ExamEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_id' })
  exam: ExamEntity;

  @ManyToOne(() => ExamCategoryEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: ExamCategoryEntity;

  @CreateDateColumn()
  createdAt: Date;
}
