import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, Index } from 'typeorm';
import { UserProgressEntity } from './user-progress.entity';

@Entity('topics')
@Index('IDX_topics_cefr_lang_active', ['cefrLevel', 'language', 'isActive'])
@Index('IDX_topics_category_active', ['category', 'isActive'])
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

  /** Primary CEFR level: A1 | A2 | B1 | B2 | C1 | C2 | null */
  @Index('IDX_topics_cefrLevel')
  @Column({ nullable: true })
  cefrLevel: string;

  /** CEFR-J sub-level e.g. A1.1, A1.2, B2.2* */
  @Column({ nullable: true })
  cefrJLevel: string;

  /** Shorthand code from CEFR-J Grammar Profile e.g. PP.I_am */
  @Column({ nullable: true, unique: true })
  shorthandCode: string;

  /** Sentence type e.g. AFF. DEC., NEG. INT. */
  @Column({ nullable: true })
  sentenceType: string;

  /** FREQ*DISP column value e.g. A1, A2, B1 */
  @Column({ nullable: true })
  freqDisp: string;

  /** Core Inventory level range e.g. A1, A2-B1, A1-C1 */
  @Column({ nullable: true })
  coreInventory: string;

  /** English Grammar Profile level range e.g. A1, A2-C1 */
  @Column({ nullable: true })
  egp: string;

  /** GSELO level range e.g. A1, B2 */
  @Column({ nullable: true })
  gselo: string;

  /** Notes / extra info (may contain Japanese) */
  @Column({ type: 'text', nullable: true })
  notes: string;

  /** Original CSV ID e.g. 1, 1-1, 56 */
  @Column({ nullable: true })
  csvId: string;

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
