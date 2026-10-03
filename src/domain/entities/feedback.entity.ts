import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { UserEntity } from './user.entity';

export type FeedbackType = 'suggestion' | 'complaint' | 'bug';

/** Suggestions, complaints and bug reports sent from the app. Kept even if the email fails. */
@Entity('feedback')
@Index(['userId', 'createdAt'])
export class FeedbackEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ length: 20 })
  type: FeedbackType;

  @Column('text')
  message: string;

  /** Where to reply; null if the user chose not to share it. */
  @Column({ name: 'contact_email', nullable: true })
  contactEmail: string | null;

  @Column({ nullable: true, length: 20 })
  platform: string | null;

  @Column({ name: 'app_version', nullable: true, length: 20 })
  appVersion: string | null;

  @Column({ name: 'email_sent', default: false })
  emailSent: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Feedback outlives a deleted account (anonymised), so the link is cleared instead of cascading
  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
