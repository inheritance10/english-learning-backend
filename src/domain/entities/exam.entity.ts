import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { ExamCategoryEntity } from './exam-category.entity';

@Entity('exams')
export class ExamEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'icon_emoji', default: '📝' })
  iconEmoji: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'order_index', default: 0 })
  orderIndex: number;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => ExamCategoryEntity, (c) => c.exam)
  categories: ExamCategoryEntity[];
}
