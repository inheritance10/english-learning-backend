import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { SubscriptionEntity, SubscriptionPlan, SubscriptionPlatform, SubscriptionStatus as SubStatus } from '../../../domain/entities/subscription.entity';
import { UserEntity } from '../../../domain/entities/user.entity';

export interface VerifyReceiptDto {
  platform: 'ios' | 'android';
  receiptData: string;        // base64 receipt (iOS) or purchase token (Android)
  productId: string;
  transactionId?: string;
}

export interface SubStatusResult {
  isActive: boolean;
  expiresAt: Date | null;
  plan: string;
  isTrial: boolean;
}

@Injectable()
export class VerifyReceiptUseCase {
  private readonly logger = new Logger(VerifyReceiptUseCase.name);

  constructor(
    @InjectRepository(SubscriptionEntity)
    private readonly subRepo: Repository<SubscriptionEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async execute(dto: VerifyReceiptDto, user: UserEntity): Promise<SubStatusResult> {
    // ── Test users always get premium ────────────────────────────────
    if (user.isTestUser) {
      this.logger.log(`Test user ${user.id} — bypassing receipt verification`);
      return this.grantPremium(user, dto.productId, null);
    }

    // ── Platform-specific verification ───────────────────────────────
    let expiresAt: Date;
    try {
      if (dto.platform === 'ios') {
        expiresAt = await this.verifyAppleReceipt(dto.receiptData, dto.productId);
      } else {
        expiresAt = await this.verifyGoogleReceipt(dto.receiptData, dto.productId);
      }
    } catch (err) {
      this.logger.error('Receipt verification failed', err);
      throw new BadRequestException('Receipt verification failed');
    }

    return this.grantPremium(user, dto.productId, expiresAt);
  }

  private async verifyAppleReceipt(receiptData: string, productId: string): Promise<Date> {
    const appleSecret = this.configService.get<string>('APPLE_SHARED_SECRET');
    const isSandbox = this.configService.get('NODE_ENV') !== 'production';

    const url = isSandbox
      ? 'https://sandbox.itunes.apple.com/verifyReceipt'
      : 'https://buy.itunes.apple.com/verifyReceipt';

    const response = await firstValueFrom(
      this.httpService.post(url, {
        'receipt-data': receiptData,
        'password': appleSecret,
        'exclude-old-transactions': true,
      }),
    );

    const { status, latest_receipt_info } = response.data as any;
    if (status !== 0) throw new Error(`Apple verification failed with status ${status}`);

    const latest = latest_receipt_info?.[latest_receipt_info.length - 1];
    if (!latest) throw new Error('No receipt info found');

    const expiresMs = parseInt(latest.expires_date_ms, 10);
    return new Date(expiresMs);
  }

  private async verifyGoogleReceipt(purchaseToken: string, productId: string): Promise<Date> {
    const packageName = this.configService.get<string>('ANDROID_PACKAGE_NAME');
    // Google Play Developer API — requires service account OAuth2
    // In production, use googleapis package with service account
    const googleApiUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;

    const accessToken = await this.getGoogleAccessToken();
    const response = await firstValueFrom(
      this.httpService.get(googleApiUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    );

    const { expiryTimeMillis, paymentState } = response.data as any;
    if (paymentState !== 1 && paymentState !== 2) {
      throw new Error('Google subscription not active');
    }

    return new Date(parseInt(expiryTimeMillis, 10));
  }

  private async getGoogleAccessToken(): Promise<string> {
    // In production: use google-auth-library with service account credentials
    // Simplified placeholder
    const serviceAccountKey = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_KEY');
    if (!serviceAccountKey) throw new Error('Google service account not configured');
    // TODO: implement OAuth2 token exchange
    return '';
  }

  private async grantPremium(
    user: UserEntity,
    productId: string,
    expiresAt: Date | null,
  ): Promise<SubStatusResult> {
    const plan = productId.includes('monthly') ? SubscriptionPlan.PRO_MONTHLY
      : productId.includes('yearly') ? SubscriptionPlan.PRO_YEARLY
      : productId.includes('lifetime') ? SubscriptionPlan.LIFETIME
      : SubscriptionPlan.PRO_MONTHLY;

    const subscriptionExpiresAt = expiresAt ?? (
      plan === 'lifetime' ? new Date('2099-12-31') : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    );

    // Upsert subscription record
    let sub = await this.subRepo.findOne({ where: { userId: user.id } });
    if (!sub) {
      sub = this.subRepo.create({ userId: user.id });
    }
    sub.plan = plan;
    sub.platform = SubscriptionPlatform.IOS;
    sub.status = SubStatus.ACTIVE;
    sub.isActive = true;
    sub.expiresAt = subscriptionExpiresAt;
    await this.subRepo.save(sub);

    // Update user
    user.isSubscribed = true;
    await this.userRepo.save(user);

    return {
      isActive: true,
      expiresAt: subscriptionExpiresAt,
      plan,
      isTrial: false,
    };
  }
}
