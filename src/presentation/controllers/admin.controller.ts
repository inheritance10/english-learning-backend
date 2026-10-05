import { Controller, Get, Post, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminQueriesUseCase } from '../../application/admin/use-cases/admin-queries.use-case';
import { AdminKeyGuard } from '../../infrastructure/auth/admin-key.guard';
import { AlertsService } from '../../application/admin/alerts.service';

@ApiTags('admin')
@UseGuards(AdminKeyGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly queries: AdminQueriesUseCase,
    private readonly alerts: AlertsService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Headline numbers for the admin panel' })
  overview() {
    return this.queries.overview();
  }

  @Get('ai')
  @ApiOperation({ summary: 'Gemini usage: daily, per feature, per model, recent errors' })
  aiUsage(@Query('days') days = '7') {
    return this.queries.aiUsage(Math.min(Math.max(Number(days) || 7, 1), 90));
  }

  @Get('jobs')
  @ApiOperation({ summary: 'Recent background runs (queue jobs and cron ticks)' })
  jobs(@Query('status') status?: string, @Query('limit') limit = '100') {
    return this.queries.jobs(status === 'ok' || status === 'failed' ? status : null, Math.min(Number(limit) || 100, 500));
  }

  @Get('jobs/summary')
  @ApiOperation({ summary: 'Last 24h per background job: runs, failures, average duration' })
  jobSummary() {
    return this.queries.jobSummary();
  }

  @Get('feedback')
  @ApiOperation({ summary: 'Feedback and complaints from the app' })
  feedback(@Query('type') type?: string, @Query('limit') limit = '100') {
    const t = ['suggestion', 'complaint', 'bug'].includes(type ?? '') ? (type as string) : null;
    return this.queries.feedback(t, Math.min(Number(limit) || 100, 500));
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'Active subscriptions' })
  subscriptions() {
    return this.queries.subscriptions();
  }

  @Get('health')
  @ApiOperation({ summary: 'Database, Redis, Gemini config and queue counts' })
  health() {
    return this.queries.health();
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Current warnings and critical alerts' })
  alertList() {
    return this.alerts.evaluate();
  }

  @Get('errors')
  @ApiOperation({ summary: 'API and Gemini errors grouped by code' })
  errors(@Query('hours') hours = '24') {
    const h = Math.min(Math.max(Number(hours) || 24, 1), 720);
    return Promise.all([this.queries.errorGroups(h), this.queries.geminiErrorGroups(h)]).then(([api, gemini]) => ({ hours: h, api, gemini }));
  }

  @Get('errors/recent')
  @ApiOperation({ summary: 'Most recent failed requests' })
  recentErrors(@Query('limit') limit = '100') {
    return this.queries.recentApiErrors(Math.min(Number(limit) || 100, 500));
  }

  @Get('question-pool')
  @ApiOperation({ summary: 'Question pool per topic: ready vs. target' })
  questionPool() {
    return this.queries.questionPool();
  }

  @Get('queues/failed')
  @ApiOperation({ summary: 'Failed jobs in a queue with BullMQ failure reasons' })
  queueFailed(@Query('queue') queue = 'question-pool', @Query('limit') limit = '50') {
    return this.queries.queueFailed(queue, Math.min(Number(limit) || 50, 200));
  }

  @Post('queues/retry-failed')
  @ApiOperation({ summary: 'Re-queue all failed jobs of one queue' })
  retryFailed(@Query('queue') queue: string) {
    if (!['question-pool', 'word-booster', 'exam-prep'].includes(queue)) throw new BadRequestException('Unknown queue');
    return this.queries.retryFailed(queue);
  }
}
