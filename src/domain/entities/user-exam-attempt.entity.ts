import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { QuestionEntity } from './question.entity';

@Entity('user_exam_attempts')
@Index(['userId', 'questionId'])
export class UserExamAttemptEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'question_id' })
  questionId: string;

  @Column({ name: 'selected_index' })
  selectedIndex: number;

  @Column({ name: 'is_correct' })
  isCorrect: boolean;

  @Column({ name: 'time_spent_ms', default: 0 })
  timeSpentMs: number;

  @Column({ name: 'topic_tag', nullable: true })
  topicTag: string;

  @Column({ name: 'exam_id', nullable: true })
  examId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => QuestionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question: QuestionEntity;

  @CreateDateColumn()
  createdAt: Date;
}
