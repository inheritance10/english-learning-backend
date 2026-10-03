import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedbackEntity } from '../../domain/entities/feedback.entity';
import { FeedbackController } from '../../presentation/controllers/feedback.controller';
import { MailService } from '../../infrastructure/mail/mail.service';
import { AuthModule } from '../auth/auth.module';
import { SubmitFeedbackUseCase } from './use-cases/submit-feedback.use-case';

@Module({
  imports: [TypeOrmModule.forFeature([FeedbackEntity]), AuthModule],
  controllers: [FeedbackController],
  providers: [SubmitFeedbackUseCase, MailService],
})
export class FeedbackModule {}
