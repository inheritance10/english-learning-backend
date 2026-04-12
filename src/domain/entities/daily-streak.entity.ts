import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('daily_streaks')
export class DailyStreakEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserEntity, (user) => user.streaks)
  user: UserEntity;

  @Column()
  userId: string;

  /** Current consecutive day count */
  @Column({ default: 0 })
  currentStreak: number;

  /** All-time best streak */
  @Column({ default: 0 })
  longestStreak: number;

  /** ISO date string of last active day (YYYY-MM-DD) */
  @Column({ nullable: true })
  lastActiveDate: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
