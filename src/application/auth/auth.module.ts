import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserEntity } from '../../domain/entities/user.entity';
import { AuthController } from '../../presentation/controllers/auth.controller';
import { SocialAuthUseCase } from './use-cases/social-auth.use-case';
import { FirebaseStrategy } from '../../infrastructure/auth/firebase.strategy';
import { JwtStrategy } from '../../infrastructure/auth/jwt.strategy';
import { FirebaseAdminService } from '../../infrastructure/auth/firebase-admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    PassportModule.register({ defaultStrategy: 'firebase-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_EXPIRES_IN', '30d') },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [SocialAuthUseCase, FirebaseStrategy, JwtStrategy, FirebaseAdminService],
  exports: [JwtModule, PassportModule, FirebaseAdminService],
})
export class AuthModule {}
