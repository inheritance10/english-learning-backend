import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { TopicEntity } from './topic.entity';

export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  FILL_IN_BLANK = 'fill_in_blank',
  SENTENCE_ORDER = 'sentence_order',
}

@Entity('quiz_questions')
@Index('IDX_quiz_questions_pool', ['topicId', 'cefrLevel', 'poolReady'])
export class QuizQuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TopicEntity, { nullable: true })
  topic: TopicEntity;

  @Column({ nullable: true })
  topicId: string;

  @Column({ type: 'enum', enum: QuestionType, default: QuestionType.MULTIPLE_CHOICE })
  type: QuestionType;

  @Column('text')
  questionText: string;

  @Column({ type: 'simple-array' })
  options: string[];

  /** Doğru şık metni — geriye dönük uyumluluk için korundu. */
  @Column()
  correctAnswer: string;

  /**
   * Doğru şık index'i (0-3).
   * Gemini ve frontend bu formatı kullanır; correctAnswer ile senkron tutulur.
   */
  @Column({ name: 'correct_index', type: 'int', nullable: true })
  correctIndex: number | null;

  @Column('text', { nullable: true })
  explanationEn: string;

  @Column('text', { nullable: true })
  explanationTr: string;

  /** Kullanıcıya yönlendirici ipucu (cevabı vermiyor). */
  @Column({ nullable: true })
  hint: string;

  /**
   * Test edilen gramer/kelime konusu.
   * Örn: "Present Perfect", "Conditional Type 2", "Collocations"
   */
  @Column({ name: 'grammar_point', nullable: true })
  grammarPoint: string;

  /** Sorunun hangi CEFR seviyesi için üretildiği: A1 | A2 | B1 | B2 | C1 | C2 */
  @Column({ name: 'cefr_level', nullable: true })
  cefrLevel: string;

  /**
   * Sorunun explanation dilini belirtir.
   * 'en' → explanationEn dolu, 'tr' → explanationTr dolu
   */
  @Column({ default: 'tr' })
  language: string;

  @Column({ nullable: true })
  userHobbyContext: string;

  @Column({ name: 'is_ai_generated', default: false })
  isAiGenerated: boolean;

  /**
   * Soru havuzda kullanıma hazır mı?
   * Cron/consumer soruyu kaydedince true yapar.
   * false olan sorular servise girmez (yarım batch koruması).
   */
  @Column({ name: 'pool_ready', default: false })
  poolReady: boolean;

  /**
   * Bu sorunun kaç kez kullanıcılara servis edildiği.
   * Analitik amaçlı; ileride "en çok çözülen soru" gibi özellikler için.
   */
  @Column({ name: 'usage_count', default: 0 })
  usageCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
