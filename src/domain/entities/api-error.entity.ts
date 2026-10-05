import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** Every failed HTTP request, so errors can be grouped by status and error code. */
@Entity('api_errors')
@Index(['createdAt'])
@Index(['statusCode', 'errorCode', 'createdAt'])
export class ApiErrorEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 10 })
  method: string;

  @Column({ length: 300 })
  path: string;

  @Column({ name: 'status_code', type: 'int' })
  statusCode: number;

  @Column({ name: 'error_code', length: 80 })
  errorCode: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'text', nullable: true })
  stack: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
