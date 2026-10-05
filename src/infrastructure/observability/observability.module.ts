import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiUsageLogEntity } from '../../domain/entities/ai-usage-log.entity';
import { JobRunEntity } from '../../domain/entities/job-run.entity';
import { ObservabilityService } from './observability.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AiUsageLogEntity, JobRunEntity])],
  providers: [ObservabilityService],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
