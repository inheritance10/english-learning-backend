import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiUsageLogEntity } from '../../domain/entities/ai-usage-log.entity';
import { JobRunEntity } from '../../domain/entities/job-run.entity';
import { ApiErrorEntity } from '../../domain/entities/api-error.entity';
import { ObservabilityService } from './observability.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AiUsageLogEntity, JobRunEntity, ApiErrorEntity])],
  providers: [ObservabilityService],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
