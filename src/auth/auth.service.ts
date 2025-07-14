/**
 * 인증 서비스
 * 
 * @description Google OAuth 인증을 처리하는 서비스입니다.
 * 크롬 익스텐션과 일반 웹 애플리케이션 모두 지원합니다.
 * JWT 토큰 기반 인증을 사용합니다.
 */

import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedUser } from './strategies/jwt.strategy';
import { UsersService } from '../users/users.service';
import { OAuthProvider } from '../users/entities/user-oauth.entity';

/**
 * Google OAuth 인증 요청 DTO
 */
export interface GoogleAuthDto {
  code: string;
  redirectUri: string;
}

/**
 * 크롬 익스텐션용 OAuth 토큰 DTO
 */
export interface ChromeExtensionTokenDto {
  accessToken: string;
  provider: 'google';
  extensionId?: string;
}

/**
 * 인증 응답 DTO
 */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    fullName?: string;
    avatarUrl?: string;
    provider: string;
  };
  expiresAt: number;
}

/**
 * 사용자 프로필 정보
 */
export interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  provider: string;
  createdAt: string;
  lastSignInAt?: string;
}

/**
 * 크롬 익스텐션 OAuth 설정
 */
export interface ChromeExtensionOAuthConfig {
  clientId: string;
  scopes: string[];
  redirectUri: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {
    this.logger.log('✅ AuthService initialized successfully for Chrome Extension');
  }

  /**
   * 크롬 익스텐션용 Google OAuth 설정 반환
   */
  getChromeExtensionOAuthConfig(): ChromeExtensionOAuthConfig {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    
    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID is not configured');
    }
    
    return {
      clientId,
      scopes: [
        'openid',
        'email',
        'profile',
      ],
      redirectUri: `chrome-extension://${process.env.CHROME_EXTENSION_ID || 'extension-id'}/auth/callback`,
    };
  }

  /**
   * 크롬 익스텐션에서 Chrome Identity API로 받은 토큰으로 인증
   */
  async authenticateWithChromeExtension(tokenDto: ChromeExtensionTokenDto): Promise<AuthResponse> {
    try {
      this.logger.log('Processing Chrome Extension OAuth authentication');

      // Google 토큰으로 사용자 정보 가져오기
      const userInfo = await this.getUserInfoFromGoogleToken(tokenDto.accessToken);
      
      // 데이터베이스에서 사용자 생성 또는 업데이트
      const user = await this.usersService.createOrUpdateOAuthUser({
        email: userInfo.email,
        name: userInfo.name,
        oauthProvider: OAuthProvider.GOOGLE,
        oauthId: userInfo.id,
        profileData: userInfo,
      });

      // JWT 토큰 생성
      const payload = { 
        sub: user.userId, 
        email: user.email,
        name: user.name,
        provider: 'google'
      };
      
      const accessToken = await this.jwtService.signAsync(payload, { expiresIn: '1h' });
      const refreshToken = await this.jwtService.signAsync(payload, { expiresIn: '7d' });

      const authResponse: AuthResponse = {
        accessToken,
        refreshToken,
        user: {
          id: user.userId.toString(),
          email: user.email,
          fullName: user.name,
          avatarUrl: userInfo.picture,
          provider: 'google',
        },
        expiresAt: Math.floor(Date.now() / 1000) + 3600, // 1시간 후
      };

      this.logger.log('Chrome Extension OAuth authentication successful', {
        userId: user.userId,
        email: user.email,
        extensionId: tokenDto.extensionId,
      });

      return authResponse;
    } catch (error) {
      this.logger.error('Chrome Extension OAuth authentication error:', error);
      
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      throw new UnauthorizedException('Chrome Extension authentication failed');
    }
  }

  /**
   * Google 토큰으로 사용자 정보 가져오기
   */
  private async getUserInfoFromGoogleToken(accessToken: string): Promise<any> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Google API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error('Failed to get user info from Google token:', error);
      throw new UnauthorizedException('Failed to get user info from Google');
    }
  }

  /**
   * Google OAuth URL 생성 (직접 구현)
   */
  async getGoogleOAuthUrl(redirectUri: string): Promise<{ url: string }> {
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      
      if (!clientId) {
        throw new Error('GOOGLE_CLIENT_ID is not configured');
      }
      
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'consent',
        state: Math.random().toString(36).substring(2, 15), // CSRF 보호용
      });

      const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      
      this.logger.log('Generated Google OAuth URL', { redirectUri, url });
      
      return { url };
    } catch (error) {
      this.logger.error('Error generating Google OAuth URL:', error);
      throw new UnauthorizedException('OAuth URL generation failed');
    }
  }

  /**
   * Google OAuth 코드로 인증 처리 (직접 구현)
   */
  async authenticateWithGoogle(authDto: GoogleAuthDto): Promise<AuthResponse> {
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        throw new Error('Google OAuth configuration is missing');
      }
      
      // 1. Google OAuth 코드를 토큰으로 교환
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: authDto.code,
          redirect_uri: authDto.redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        this.logger.error('Google token exchange failed:', error);
        throw new UnauthorizedException('Google token exchange failed');
      }

      const tokenData = await tokenResponse.json();
      
      // 2. Google API로 사용자 정보 가져오기
      const userInfo = await this.getUserInfoFromGoogleToken(tokenData.access_token);
      
      // 3. 데이터베이스에서 사용자 생성 또는 업데이트
      const user = await this.usersService.createOrUpdateOAuthUser({
        email: userInfo.email,
        name: userInfo.name,
        oauthProvider: OAuthProvider.GOOGLE,
        oauthId: userInfo.id,
        profileData: userInfo,
      });

      // 4. JWT 토큰 생성
      const payload = { 
        sub: user.userId, 
        email: user.email,
        name: user.name,
        provider: 'google'
      };
      
      const accessToken = await this.jwtService.signAsync(payload, { expiresIn: '1h' });
      const refreshToken = await this.jwtService.signAsync(payload, { expiresIn: '7d' });

      const authResponse: AuthResponse = {
        accessToken,
        refreshToken,
        user: {
          id: user.userId.toString(),
          email: user.email,
          fullName: user.name,
          avatarUrl: userInfo.picture,
          provider: 'google',
        },
        expiresAt: Math.floor(Date.now() / 1000) + 3600, // 1시간 후
      };

      this.logger.log('Google OAuth authentication successful', {
        userId: user.userId,
        email: user.email,
      });

      return authResponse;
    } catch (error) {
      this.logger.error('Google OAuth authentication error:', error);
      
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      throw new UnauthorizedException('Google authentication failed');
    }
  }

  /**
   * 토큰 갱신
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      // JWT refresh token 검증
      const payload = await this.jwtService.verifyAsync(refreshToken);
      
      // 사용자 정보 조회
      const user = await this.usersService.findOne(payload.sub);
      
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // 새로운 토큰 생성
      const newPayload = { 
        sub: user.userId, 
        email: user.email,
        name: user.name,
        provider: 'google'
      };
      
      const accessToken = await this.jwtService.signAsync(newPayload, { expiresIn: '1h' });
      const newRefreshToken = await this.jwtService.signAsync(newPayload, { expiresIn: '7d' });

      const authResponse: AuthResponse = {
        accessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user.userId.toString(),
          email: user.email,
          fullName: user.name,
          avatarUrl: user.oauthAccounts?.[0]?.profileData?.picture,
          provider: 'google',
        },
        expiresAt: Math.floor(Date.now() / 1000) + 3600, // 1시간 후
      };

      this.logger.log('Token refresh successful', {
        userId: user.userId,
        email: user.email,
      });

      return authResponse;
    } catch (error) {
      this.logger.error('Token refresh error:', error);
      
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      throw new UnauthorizedException('Token refresh failed');
    }
  }

  /**
   * 사용자 프로필 조회
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    try {
      const user = await this.usersService.findOne(parseInt(userId));

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const profile: UserProfile = {
        id: user.userId.toString(),
        email: user.email,
        fullName: user.name,
        avatarUrl: user.oauthAccounts?.[0]?.profileData?.picture,
        provider: user.oauthAccounts?.[0]?.oauthProvider || 'google',
        createdAt: user.createdAt.toISOString(),
        lastSignInAt: user.updatedAt.toISOString(),
      };

      return profile;
    } catch (error) {
      this.logger.error('Get user profile error:', error);
      
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      throw new UnauthorizedException('Failed to get user profile');
    }
  }

  /**
   * 로그아웃
   */
  async logout(accessToken: string): Promise<void> {
    try {
      // JWT 기반에서는 토큰을 단순히 무효화하는 방식을 사용
      // 실제로는 클라이언트에서 토큰을 삭제하는 방식으로 처리
      this.logger.log('User logged out successfully');
    } catch (error) {
      this.logger.error('Logout error:', error);
      throw new UnauthorizedException('Logout failed');
    }
  }

  /**
   * 사용자 정보 검증 (토큰 검증용)
   */
  async validateUser(user: AuthenticatedUser): Promise<AuthenticatedUser> {
    try {
      // 추가 사용자 검증 로직이 필요한 경우 여기에 구현
      // 예: 사용자 상태 확인, 권한 검증 등
      
      const profile = await this.getUserProfile(user.id);
      
      // 사용자 정보 업데이트
      return {
        ...user,
        metadata: {
          ...user.metadata,
          fullName: profile.fullName || user.metadata.fullName,
          avatarUrl: profile.avatarUrl || user.metadata.avatarUrl,
        },
      };
    } catch (error) {
      this.logger.error('User validation error:', error);
      throw new UnauthorizedException('User validation failed');
    }
  }
} 