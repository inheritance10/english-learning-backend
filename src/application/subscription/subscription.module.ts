import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { SubscriptionEntity } from '../../domain/entities/subscription.entity';
import { UserEntity } from '../../domain/entities/user.entity';
import { VerifyReceiptUseCase } from './use-cases/verify-receipt.use-case';
import { CheckTrialUseCase } from './use-cases/check-trial.use-case';
import { SubscriptionController } from '../../presentation/controllers/subscription.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubscriptionEntity, UserEntity]),
    HttpModule,
    AuthModule,
  ],
  controllers: [SubscriptionController],
  providers: [VerifyReceiptUseCase, CheckTrialUseCase],
  exports: [VerifyReceiptUseCase, CheckTrialUseCase],
})
export class SubscriptionModule {}
