import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminQueriesUseCase } from '../../application/admin/use-cases/admin-queries.use-case';
import { AdminKeyGuard } from '../../infrastructure/auth/admin-key.guard';

@ApiTags('admin')
@UseGuards(AdminKeyGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly queries: AdminQueriesUseCase) {}

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
}
