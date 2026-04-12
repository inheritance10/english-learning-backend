import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { UserEntity } from './user.entity';
import { TopicEntity } from './topic.entity';

@Entity('user_progress')
export class UserProgressEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserEntity, (user) => user.progressRecords)
  user: UserEntity;

  @Column()
  userId: string;

  @ManyToOne(() => TopicEntity, (topic) => topic.progressRecords)
  topic: TopicEntity;

  @Column({ nullable: true })
  topicId: string;

  /** ISO date (YYYY-MM-DD) for daily aggregation */
  @Column({ nullable: true })
  date: string;

  @Column({ default: 0 })
  xpEarned: number;

  @Column({ default: 0 })
  questionsAnswered: number;

  @Column({ default: 0 })
  correctAnswers: number;

  @Column({ type: 'float', default: 0 })
  successRate: number;

  @Column({ default: false })
  isCompleted: boolean;

  @Column({ default: 0 })
  timeSpentSeconds: number;

  @CreateDateColumn()
  startedAt: Date;

  @UpdateDateColumn()
  lastActivityAt: Date;
}
