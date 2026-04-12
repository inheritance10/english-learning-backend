import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { SubscriptionEntity } from './subscription.entity';
import { VocabularyItemEntity } from './vocabulary-item.entity';
import { UserProgressEntity } from './user-progress.entity';
import { DailyStreakEntity } from './daily-streak.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  firebaseUid: string;

  @Column({ nullable: true })
  email: string;

  /** Display name from Firebase */
  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  avatarUrl: string;

  /** App language: 'en' | 'tr' */
  @Column({ default: 'en' })
  language: string;

  /** CEFR level: A1 | A2 | B1 | B2 | C1 | C2 */
  @Column({ nullable: true })
  cefrLevel: string;

  @Column({ type: 'simple-array', nullable: true })
  interests: string[];

  @Column({ default: false })
  isTestUser: boolean;

  @Column({ default: false })
  isSubscribed: boolean;

  @Column({ nullable: true })
  trialStartedAt: Date;

  @Column({ nullable: true })
  trialEndsAt: Date;

  @Column({ default: false })
  onboardingCompleted: boolean;

  @OneToMany(() => SubscriptionEntity, (sub) => sub.user, { eager: false })
  subscriptions: SubscriptionEntity[];

  @OneToMany(() => VocabularyItemEntity, (vocab) => vocab.user, { eager: false })
  vocabularyItems: VocabularyItemEntity[];

  @OneToMany(() => UserProgressEntity, (progress) => progress.user, { eager: false })
  progressRecords: UserProgressEntity[];

  @OneToMany(() => DailyStreakEntity, (streak) => streak.user, { eager: false })
  streaks: DailyStreakEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
