import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('words')
@Index(['level'])
export class WordEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  word: string;

  @Column()
  meaning: string;

  @Column({ nullable: true })
  exampleSentence: string;

  @Column({ nullable: true })
  usageNote: string;

  /** A1 | A2 | B1 | B2 | C1 | C2 */
  @Column()
  level: string;

  @CreateDateColumn()
  createdAt: Date;
}
