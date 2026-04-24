import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('user_completed_topics')
export class UserCompletedTopicEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserEntity, (user) => user.completedTopics)
  user: UserEntity;

  @Column()
  userId: string;

  @Column()
  topicId: string;

  @Column()
  topicName: string;

  @Column({ nullable: true })
  topicCategory: string;

  @Column({ nullable: true })
  cefrLevel: string;

  @CreateDateColumn()
  completedAt: Date;
}