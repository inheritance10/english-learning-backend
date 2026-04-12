import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { UserProgressEntity } from './user-progress.entity';

@Entity('topics')
export class TopicEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Primary display name used in AI prompts */
  @Column()
  name: string;

  @Column({ nullable: true })
  titleTr: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  descriptionTr: string;

  /** grammar | vocabulary | business | conversation | writing */
  @Column()
  category: string;

  /** A1 | A2 | B1 | B2 | C1 | C2 */
  @Column()
  cefrLevel: string;

  /** en | tr */
  @Column({ default: 'en' })
  language: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isPremium: boolean;

  @Column({ default: 0 })
  orderIndex: number;

  @Column({ nullable: true })
  icon: string;

  @Column({ default: 15 })
  estimatedMinutes: number;

  @OneToMany(() => UserProgressEntity, (p) => p.topic)
  progressRecords: UserProgressEntity[];

  @CreateDateColumn()
  createdAt: Date;
}
