import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Job } from 'bullmq';
import { AiUsageLogEntity } from '../../domain/entities/ai-usage-log.entity';
import { JobRunEntity } from '../../domain/entities/job-run.entity';

const MAX_ERROR_LENGTH = 1000;

/** Writes usage and job history without ever failing the caller. */
@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);

  constructor(
    @InjectRepository(AiUsageLogEntity)
    private readonly aiRepo: Repository<AiUsageLogEntity>,
    @InjectRepository(JobRunEntity)
    private readonly jobRepo: Repository<JobRunEntity>,
  ) {}

  recordAi(entry: Partial<AiUsageLogEntity>): void {
    this.aiRepo
      .insert({ ...entry, error: entry.error ? entry.error.slice(0, MAX_ERROR_LENGTH) : null })
      .catch((err) => this.logger.warn(`AI usage not stored: ${err?.message}`));
  }

  recordJob(entry: Partial<JobRunEntity>): void {
    this.jobRepo
      .insert({ ...entry, error: entry.error ? entry.error.slice(0, MAX_ERROR_LENGTH) : null })
      .catch((err) => this.logger.warn(`Job run not stored: ${err?.message}`));
  }

  recordQueueJob(queue: string, job: Job, status: 'ok' | 'failed', err?: Error): void {
    const startedAt = new Date(job.processedOn ?? job.timestamp ?? Date.now());
    const durationMs = job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : 0;
    this.recordJob({
      name: `${queue}:${job.name}`,
      kind: 'queue',
      status,
      startedAt,
      durationMs,
      error: err ? String(err.message ?? err) : null,
      meta: { jobId: job.id, attempt: job.attemptsMade },
    });
  }

  /** Runs a cron body and records it; errors are recorded and rethrown. */
  async runCron<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const startedAt = new Date();
    try {
      const result = await fn();
      this.recordJob({ name: `cron:${name}`, kind: 'cron', status: 'ok', startedAt, durationMs: Date.now() - startedAt.getTime() });
      return result;
    } catch (err: any) {
      this.recordJob({
        name: `cron:${name}`,
        kind: 'cron',
        status: 'failed',
        startedAt,
        durationMs: Date.now() - startedAt.getTime(),
        error: String(err?.message ?? err),
      });
      throw err;
    }
  }
}
