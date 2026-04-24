import { Controller, Post, Body, Get, UseGuards, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';
import { SocialAuthUseCase } from '../../application/auth/use-cases/social-auth.use-case';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { UserEntity } from '../../domain/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

class SocialAuthDto {
  @IsString()
  firebaseToken: string;

  @IsOptional()
  @IsIn(['en', 'tr'])
  language?: 'en' | 'tr';
}

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
  cefrLevel?: string;

  @IsOptional()
  @IsIn(['en', 'tr'])
  language?: 'en' | 'tr';

  @IsOptional()
  interests?: string[];
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly socialAuth: SocialAuthUseCase,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  @Public()
  @Post('social')
  @ApiOperation({ summary: 'Sign in with Google or Apple via Firebase' })
  async socialSignIn(@Body() dto: SocialAuthDto) {
    return this.socialAuth.execute(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@CurrentUser() user: UserEntity) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      language: user.language,
      cefrLevel: user.cefrLevel,
      interests: user.interests,
      isSubscribed: user.isSubscribed,
      isTestUser: user.isTestUser,
      trialEndsAt: user.trialEndsAt,
      totalTokens: user.totalTokens,
      createdAt: user.createdAt,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile (CEFR level, language, interests)' })
  async updateProfile(
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateProfileDto,
  ) {
    Object.assign(user, dto);
    const updated = await this.userRepo.save(user);
    return { id: updated.id, cefrLevel: updated.cefrLevel, language: updated.language, interests: updated.interests };
  }
}
