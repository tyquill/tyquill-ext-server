/**
 * 인증 모듈
 * 
 * @description Supabase Google OAuth 인증을 위한 NestJS 모듈입니다.
 * Linear issue CHI-40 요구사항에 따라 구현되었습니다.
 */

import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { CallbackController } from './callback.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard, OptionalJwtAuthGuard } from './guards/jwt-auth.guard';
import { getJwtSecret } from '../config/supabase.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: {
          expiresIn: '1h', // 기본 만료 시간
        },
      }),
    }),
  ],
  controllers: [AuthController, CallbackController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    PassportModule,
    JwtModule,
  ],
})
export class AuthModule {
  constructor() {
    console.log('🔐 AuthModule initialized');
  }
} 