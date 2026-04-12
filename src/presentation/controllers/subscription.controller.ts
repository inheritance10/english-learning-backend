import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsIn } from 'class-validator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UserEntity } from '../../domain/entities/user.entity';
import { VerifyReceiptUseCase } from '../../application/subscription/use-cases/verify-receipt.use-case';
import { CheckTrialUseCase } from '../../application/subscription/use-cases/check-trial.use-case';

class VerifyReceiptDto {
  @IsIn(['ios', 'android'])
  platform: 'ios' | 'android';

  @IsString()
  receiptData: string;

  @IsString()
  productId: string;
}

@ApiTags('subscription')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly verifyReceipt: VerifyReceiptUseCase,
    private readonly checkTrial: CheckTrialUseCase,
  ) {}

  @Post('verify')
  @ApiOperation({ summary: 'Verify Apple/Google IAP receipt and activate subscription' })
  async verify(@Body() dto: VerifyReceiptDto, @CurrentUser() user: UserEntity) {
    return this.verifyReceipt.execute(dto, user);
  }

  @Get('status')
  @ApiOperation({ summary: 'Check subscription or trial status' })
  async status(@CurrentUser() user: UserEntity) {
    return this.checkTrial.execute(user);
  }

  @Get('plans')
  @ApiOperation({ summary: 'Get available subscription plans' })
  getPlans() {
    return {
      plans: [
        {
          id: 'basic',
          name: 'Basic',
          price: 0,
          currency: 'USD',
          interval: null,
          features: ['5 lessons/day', 'Basic AI feedback', 'Progress tracking'],
          isFree: true,
        },
        {
          id: 'pro_monthly',
          productId: 'com.langlearn.pro.monthly',
          name: 'Pro Monthly',
          price: 9.99,
          currency: 'USD',
          interval: 'month',
          features: ['Unlimited lessons', 'Advanced AI tutor', 'Vocabulary bank', 'Streaming chat', 'Priority support'],
          isFree: false,
        },
        {
          id: 'pro_yearly',
          productId: 'com.langlearn.pro.yearly',
          name: 'Pro Yearly',
          price: 59.99,
          currency: 'USD',
          interval: 'year',
          features: ['Everything in Pro Monthly', '50% savings', 'Offline mode', 'Custom learning path'],
          isFree: false,
          badge: 'Best Value',
        },
        {
          id: 'lifetime',
          productId: 'com.langlearn.pro.lifetime',
          name: 'Lifetime',
          price: 149.99,
          currency: 'USD',
          interval: null,
          features: ['Everything forever', 'All future features', 'One-time payment'],
          isFree: false,
          badge: 'Limited Offer',
        },
      ],
    };
  }
}
