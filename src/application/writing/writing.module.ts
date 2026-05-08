import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WritingActivityEntity } from '../../domain/entities/writing-activity.entity';
import { UserEntity } from '../../domain/entities/user.entity';
import { GeminiService } from '../../infrastructure/gemini/gemini.service';
import { AuthModule } from '../auth/auth.module';
import { GenerateScenarioUseCase } from './use-cases/generate-scenario.use-case';
import { AnalyzeWritingUseCase } from './use-cases/analyze-writing.use-case';
import { WritingController } from '../../presentation/controllers/writing.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([WritingActivityEntity, UserEntity]),
    AuthModule,
  ],
  controllers: [WritingController],
  providers: [GeminiService, GenerateScenarioUseCase, AnalyzeWritingUseCase],
})
export class WritingModule {}
