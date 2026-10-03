import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RewardPurchaseEntity } from '../../domain/entities/reward-purchase.entity';
import { RewardsController } from '../../presentation/controllers/rewards.controller';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { GetRewardsUseCase } from './use-cases/get-rewards.use-case';
import { RedeemRewardUseCase } from './use-cases/redeem-reward.use-case';

@Module({
  imports: [TypeOrmModule.forFeature([RewardPurchaseEntity]), AuthModule, SubscriptionModule],
  controllers: [RewardsController],
  providers: [GetRewardsUseCase, RedeemRewardUseCase],
})
export class RewardsModule {}
