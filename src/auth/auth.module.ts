/**
 * 인증 모듈
 *
 * @description JWT 기반 Google OAuth 인증을 위한 NestJS 모듈입니다.
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
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: () => {
        const jwtSecret = process.env.JWT_SECRET;

        if (!jwtSecret) {
          throw new Error(
            'FATAL: JWT_SECRET environment variable is required for security. ' +
            'Please set JWT_SECRET in your .env file.'
          );
        }

        return {
          secret: jwtSecret,
          signOptions: {
            expiresIn: '1h',
            algorithm: 'HS256',
            issuer: 'tyquill-ext-server',
            audience: 'tyquill-ext-client',
          },
          verifyOptions: {
            algorithms: ['HS256'],
            issuer: 'tyquill-ext-server',
            audience: 'tyquill-ext-client',
          },
        };
      },
    }),
    UsersModule,
    NotificationsModule,
  ],
  controllers: [AuthController, CallbackController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, OptionalJwtAuthGuard],
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
