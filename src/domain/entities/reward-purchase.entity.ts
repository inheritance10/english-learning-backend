import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { UserEntity } from './user.entity';

export type RewardKey = 'extra_reading' | 'extra_writing' | 'pro_day';

/** A reward bought with tokens. The token balance itself lives on users."totalTokens". */
@Entity('reward_purchases')
@Index(['userId', 'reward', 'createdAt'])
export class RewardPurchaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ length: 30 })
  reward: RewardKey;

  @Column({ type: 'int' })
  cost: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
