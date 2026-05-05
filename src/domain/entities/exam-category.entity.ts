import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ExamEntity } from './exam.entity';

@Entity('exam_categories')
export class ExamCategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'exam_id' })
  examId: string;

  @Column()
  name: string;

  @Column({ name: 'name_tr', nullable: true })
  nameTr: string;

  @Column({ name: 'icon_emoji', default: '📚' })
  iconEmoji: string;

  @Column({ name: 'order_index', default: 0 })
  orderIndex: number;

  @Column({ name: 'question_count', default: 0 })
  questionCount: number;

  @ManyToOne(() => ExamEntity, (e) => e.categories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_id' })
  exam: ExamEntity;

  @CreateDateColumn()
  createdAt: Date;
}
