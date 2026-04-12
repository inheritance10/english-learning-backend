import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { UserEntity } from './user.entity';

export enum VocabularyStatus {
  NEW = 'new',
  LEARNING = 'learning',
  MASTERED = 'mastered',
}

@Entity('vocabulary_items')
export class VocabularyItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserEntity, (user) => user.vocabularyItems)
  user: UserEntity;

  @Column()
  userId: string;

  @Column()
  word: string;

  @Column({ nullable: true })
  translation: string;

  @Column({ nullable: true })
  definition: string;

  @Column({ nullable: true })
  exampleSentence: string;

  @Column({ nullable: true })
  topicId: string;

  @Column({ type: 'enum', enum: VocabularyStatus, default: VocabularyStatus.NEW })
  status: VocabularyStatus;

  @Column({ default: 0 })
  reviewCount: number;

  @Column({ nullable: true })
  lastReviewedAt: Date;

  @Column({ default: false })
  isFromQuizMistake: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
