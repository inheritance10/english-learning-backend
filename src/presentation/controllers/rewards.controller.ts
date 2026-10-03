import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UserEntity } from '../../domain/entities/user.entity';
import { GetRewardsUseCase } from '../../application/rewards/use-cases/get-rewards.use-case';
import { RedeemRewardUseCase } from '../../application/rewards/use-cases/redeem-reward.use-case';

@ApiTags('rewards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rewards')
export class RewardsController {
  constructor(
    private readonly getRewards: GetRewardsUseCase,
    private readonly redeemReward: RedeemRewardUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Token balance and the rewards that can be bought with it' })
  list(@CurrentUser() user: UserEntity) {
    return this.getRewards.execute(user);
  }

  @Post(':key/redeem')
  @ApiOperation({ summary: 'Spend tokens on a reward' })
  redeem(@Param('key') key: string, @CurrentUser() user: UserEntity) {
    return this.redeemReward.execute(key, user);
  }
}
