/**
 * JWT 인증 전략
 * 
 * @description JWT 토큰을 검증하는 Passport 전략입니다.
 * Linear issue CHI-40 요구사항에 따라 구현되었습니다.
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
// Removed Supabase config import

/**
 * JWT 페이로드 인터페이스
 */
export interface JwtPayload {
  sub: string; // 사용자 ID (UUID)
  email: string;
  aud: string; // 대상 (audience)
  role: string; // 사용자 역할
  iat: number; // 발급 시간
  exp: number; // 만료 시간
  iss: string; // 발급자
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
  user_metadata?: {
    avatar_url?: string;
    email?: string;
    email_verified?: boolean;
    full_name?: string;
    iss?: string;
    name?: string;
    picture?: string;
    provider_id?: string;
    sub?: string;
  };
}

/**
 * 검증된 사용자 정보
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  metadata: {
    fullName?: string;
    avatarUrl?: string;
    provider?: string;
  };
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const jwtSecret = process.env.JWT_SECRET || 'your-fallback-secret-key';
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
      issuer: 'tyquill-ext-server',
      audience: 'tyquill-ext-client',
    });

    console.log('✅ JWT Strategy initialized successfully');
  }

  /**
   * JWT 토큰 검증 및 사용자 정보 반환
   * @param payload JWT 페이로드
   * @returns 검증된 사용자 정보
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    try {
      // 기본 페이로드 검증
      if (!payload.sub || !payload.email) {
        throw new UnauthorizedException('Invalid JWT payload: missing required fields');
      }

      // 토큰 만료 검증 (추가 보안)
      const currentTime = Math.floor(Date.now() / 1000);
      if (payload.exp < currentTime) {
        throw new UnauthorizedException('JWT token has expired');
      }

      // 역할 검증 (기본적으로 authenticated 역할 필요)
      // 임시로 role 검증 비활성화 - 기존 토큰 호환성을 위해
      // if (payload.role !== 'authenticated') {
      //   throw new UnauthorizedException('Invalid user role');
      // }

      // 사용자 정보 구성
      const user: AuthenticatedUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role || 'authenticated', // 기본값 설정
        metadata: {
          fullName: payload.user_metadata?.full_name || payload.user_metadata?.name,
          avatarUrl: payload.user_metadata?.avatar_url || payload.user_metadata?.picture,
          provider: payload.app_metadata?.provider,
        },
      };

      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      console.error('JWT validation error:', error);
      throw new UnauthorizedException('JWT token validation failed');
    }
  }
}

/**
 * JWT 토큰에서 사용자 ID 추출 유틸리티
 */
export function extractUserIdFromToken(token: string): string | null {
  try {
    // 간단한 JWT 디코딩 (검증 없이)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf-8')
    );

    return payload.sub || null;
  } catch (error) {
    console.error('Error extracting user ID from token:', error);
    return null;
  }
}

/**
 * JWT 토큰 만료 시간 확인 유틸리티
 */
export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return true;
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf-8')
    );

    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true;
  }
} 