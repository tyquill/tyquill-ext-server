/**
 * JWT 인증 가드
 * 
 * @description API 엔드포인트에서 JWT 토큰을 검증하는 가드입니다.
 * Linear issue CHI-40 요구사항에 따라 모든 API 요청에 Authorization Bearer 헤더를 검증합니다.
 */

import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { isTokenExpired } from '../strategies/jwt.strategy';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  /**
   * 요청 처리 전 사전 검증
   */
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    // Authorization 헤더 존재 확인
    if (!authHeader) {
      this.logger.warn('Missing Authorization header');
      throw new UnauthorizedException('Authorization header is required');
    }

    // Bearer 형식 확인
    if (!authHeader.startsWith('Bearer ')) {
      this.logger.warn('Invalid Authorization header format');
      throw new UnauthorizedException('Authorization header must be in Bearer format');
    }

    // 토큰 추출
    const token = authHeader.substring(7);
    if (!token) {
      this.logger.warn('Empty JWT token');
      throw new UnauthorizedException('JWT token is required');
    }

    // 토큰 만료 사전 검증
    if (isTokenExpired(token)) {
      this.logger.warn('Expired JWT token');
      throw new UnauthorizedException('JWT token has expired');
    }

    return super.canActivate(context);
  }

  /**
   * 인증 에러 처리
   */
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    
    if (err || !user) {
      this.logger.error('JWT authentication failed', {
        error: err?.message,
        info: info?.message,
        url: request.url,
        method: request.method,
        userAgent: request.headers['user-agent'],
      });

      // 구체적인 에러 메시지 처리
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('JWT token has expired');
      }

      if (info?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid JWT token');
      }

      if (info?.name === 'NotBeforeError') {
        throw new UnauthorizedException('JWT token not active');
      }

      throw err || new UnauthorizedException('Authentication failed');
    }

    // 성공적인 인증 로깅
    this.logger.debug('JWT authentication successful', {
      userId: user.id,
      email: user.email,
      url: request.url,
      method: request.method,
    });

    return user;
  }
}

/**
 * 선택적 JWT 인증 가드
 * 
 * @description 토큰이 있으면 검증하고, 없으면 통과시키는 가드입니다.
 * 공개 API와 인증된 API를 동시에 지원할 때 사용됩니다.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(OptionalJwtAuthGuard.name);

  /**
   * 요청 처리 전 사전 검증 (선택적)
   */
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    // Authorization 헤더가 없으면 인증 없이 통과
    if (!authHeader) {
      return true;
    }

    // Authorization 헤더가 있으면 정상 검증 수행
    return super.canActivate(context);
  }

  /**
   * 선택적 인증 에러 처리
   */
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();

    if (err || (!user && request.headers.authorization)) {
      this.logger.warn('Optional JWT authentication failed', {
        error: err?.message,
        info: info?.message,
        url: request.url,
        method: request.method,
      });

      // 선택적 가드에서는 에러를 던지지 않고 null 반환
      return null;
    }

    if (user) {
      this.logger.debug('Optional JWT authentication successful', {
        userId: user.id,
        email: user.email,
        url: request.url,
        method: request.method,
      });
    }

    return user;
  }
} 