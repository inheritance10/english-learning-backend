import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UserEntity } from '../../../domain/entities/user.entity';
import { FirebaseAdminService } from '../../../infrastructure/auth/firebase-admin.service';

export interface SocialAuthDto {
  firebaseToken: string;
  language?: 'en' | 'tr';
}

export interface AuthResult {
  accessToken: string;
  user: Partial<UserEntity>;
  isNewUser: boolean;
}

@Injectable()
export class SocialAuthUseCase {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly firebaseAdmin: FirebaseAdminService,
  ) {}

  async execute(dto: SocialAuthDto): Promise<AuthResult> {
    // 1. Verify Firebase token
    let decodedToken: any;
    try {
      decodedToken = await this.firebaseAdmin.verifyIdToken(dto.firebaseToken);
    } catch {
      throw new UnauthorizedException('Invalid Firebase token');
    }

    const { uid, email, name, picture } = decodedToken;

    // 2. Find or create user
    let user = await this.userRepo.findOne({ where: { firebaseUid: uid } });
    const isNewUser = !user;

    if (!user) {
      user = this.userRepo.create({
        firebaseUid: uid,
        email: email ?? null,
        name: name ?? 'Learner',
        avatarUrl: picture ?? null,
        language: dto.language ?? 'en',
        trialStartedAt: new Date(),
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });
      user = await this.userRepo.save(user);
    }

    // 3. Issue JWT
    const payload = { sub: user.id, email: user.email, firebaseUid: uid };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        language: user.language,
        cefrLevel: user.cefrLevel,
        trialEndsAt: user.trialEndsAt,
        isSubscribed: user.isSubscribed,
        isTestUser: user.isTestUser,
      },
      isNewUser,
    };
  }
}
