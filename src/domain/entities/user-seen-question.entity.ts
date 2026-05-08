import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { QuizQuestionEntity } from './quiz-question.entity';

/**
 * Bir kullanıcının hangi havuz sorularını gördüğünü takip eder.
 *
 * Design:
 * - UserSeenWordEntity pattern'i birebir izlendi.
 * - `expiresAt`: 30 gün sonra soru yeniden gösterilebilir.
 *   Bu, havuzun çok küçük kaldığı durumlarda kullanıcının hiç soru
 *   bulamaması sorununu önler.
 * - `answeredCorrectly`: Zayıf nokta analitiği için veri biriktirir.
 *
 * Query pattern (havuzu filtrelerken):
 *   WHERE q.id NOT IN (
 *     SELECT questionId FROM user_seen_questions
 *     WHERE userId = :uid AND expiresAt > NOW()
 *   )
 */
@Entity('user_seen_questions')
@Unique(['userId', 'questionId'])
@Index('IDX_user_seen_questions_uid_exp', ['userId', 'expiresAt'])
export class UserSeenQuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'question_id' })
  questionId: string;

  /** Kullanıcı soruyu doğru mu cevapladı? Quiz submit'te güncellenir. */
  @Column({ name: 'answered_correctly', nullable: true })
  answeredCorrectly: boolean | null;

  /** Soruyu gördüğündeki CEFR seviyesi (kullanıcı seviye atlayabilir). */
  @Column({ name: 'seen_at_level', nullable: true })
  seenAtLevel: string;

  /**
   * Bu kayıt geçerlilik tarihi.
   * Geçmiş tarihse soru "yeniden gösterilebilir" sayılır.
   * Default: seenAt + 30 gün.
   */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'seen_at' })
  seenAt: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => QuizQuestionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question: QuizQuestionEntity;
}
