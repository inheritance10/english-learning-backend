import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReadingActivityEntity } from '../../domain/entities/reading-activity.entity';
import { UserEntity } from '../../domain/entities/user.entity';
import { GenerateReadingUseCase } from './use-cases/generate-reading.use-case';
import { SubmitReadingUseCase } from './use-cases/submit-reading.use-case';
import { ReadingActivityController } from '../../presentation/controllers/reading-activity.controller';
import { GeminiService } from '../../infrastructure/gemini/gemini.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReadingActivityEntity, UserEntity]),
    AuthModule,
  ],
  controllers: [ReadingActivityController],
  providers: [GenerateReadingUseCase, SubmitReadingUseCase, GeminiService],
})
export class ReadingActivityModule {}
