/**
 * 인증 서비스
 * 
 * @description Supabase를 통한 Google OAuth 인증을 처리하는 서비스입니다.
 * 크롬 익스텐션과 일반 웹 애플리케이션 모두 지원합니다.
 * Linear issue CHI-40 요구사항에 따라 구현되었습니다.
 */

import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { 
  createSupabaseClient, 
  createSupabaseAdminClient, 
  validateGoogleOAuthConfig,
  SupabaseConfigError 
} from '../config/supabase.config';
import { AuthenticatedUser } from './strategies/jwt.strategy';

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
  private readonly supabase;
  private readonly adminSupabase;

  constructor() {
    try {
      this.supabase = createSupabaseClient();
      this.adminSupabase = createSupabaseAdminClient();
      
      // Google OAuth 설정 검증
      validateGoogleOAuthConfig();
      
      this.logger.log('✅ AuthService initialized successfully for Chrome Extension');
    } catch (error) {
      if (error instanceof SupabaseConfigError) {
        this.logger.error('❌ AuthService initialization failed:', error.message);
        throw new Error(`AuthService setup failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 크롬 익스텐션용 Google OAuth 설정 반환
   */
  getChromeExtensionOAuthConfig(): ChromeExtensionOAuthConfig {
    const { clientId } = validateGoogleOAuthConfig();
    
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
      
      // Supabase에서 사용자 생성 또는 업데이트
      const { data, error } = await this.supabase.auth.signInWithIdToken({
        provider: 'google',
        token: tokenDto.accessToken,
      });

      if (error) {
        this.logger.error('Chrome Extension OAuth authentication failed:', error);
        throw new UnauthorizedException('Chrome Extension authentication failed');
      }

      if (!data.session || !data.user) {
        throw new UnauthorizedException('No session or user data received from Chrome Extension auth');
      }

      // 사용자 정보 구성
      const user = {
        id: data.user.id,
        email: data.user.email!,
        fullName: userInfo.name || data.user.user_metadata?.full_name,
        avatarUrl: userInfo.picture || data.user.user_metadata?.avatar_url,
        provider: 'google',
      };

      const authResponse: AuthResponse = {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user,
        expiresAt: data.session.expires_at || 0,
      };

      this.logger.log('Chrome Extension OAuth authentication successful', {
        userId: user.id,
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
   * Google OAuth URL 생성 (일반 웹 애플리케이션용)
   */
  async getGoogleOAuthUrl(redirectUri: string): Promise<{ url: string }> {
    try {
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        this.logger.error('Failed to generate Google OAuth URL:', error);
        throw new UnauthorizedException('Failed to generate OAuth URL');
      }

      return { url: data.url };
    } catch (error) {
      this.logger.error('Error generating Google OAuth URL:', error);
      throw new UnauthorizedException('OAuth URL generation failed');
    }
  }

  /**
   * Google OAuth 코드로 인증 처리 (일반 웹 애플리케이션용)
   */
  async authenticateWithGoogle(authDto: GoogleAuthDto): Promise<AuthResponse> {
    try {
      const { data, error } = await this.supabase.auth.exchangeCodeForSession(authDto.code);

      if (error) {
        this.logger.error('Google OAuth authentication failed:', error);
        throw new UnauthorizedException('Google authentication failed');
      }

      if (!data.session || !data.user) {
        throw new UnauthorizedException('No session or user data received');
      }

      // 사용자 정보 구성
      const user = {
        id: data.user.id,
        email: data.user.email!,
        fullName: data.user.user_metadata?.full_name || data.user.user_metadata?.name,
        avatarUrl: data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture,
        provider: 'google',
      };

      const authResponse: AuthResponse = {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user,
        expiresAt: data.session.expires_at || 0,
      };

      this.logger.log('Google OAuth authentication successful', {
        userId: user.id,
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
      const { data, error } = await this.supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error) {
        this.logger.error('Token refresh failed:', error);
        throw new UnauthorizedException('Token refresh failed');
      }

      if (!data.session || !data.user) {
        throw new UnauthorizedException('No session or user data received');
      }

      const user = {
        id: data.user.id,
        email: data.user.email!,
        fullName: data.user.user_metadata?.full_name || data.user.user_metadata?.name,
        avatarUrl: data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture,
        provider: data.user.app_metadata?.provider || 'google',
      };

      const authResponse: AuthResponse = {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user,
        expiresAt: data.session.expires_at || 0,
      };

      this.logger.log('Token refresh successful', {
        userId: user.id,
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
      const { data, error } = await this.adminSupabase.auth.admin.getUserById(userId);

      if (error) {
        this.logger.error('Failed to get user profile:', error);
        throw new UnauthorizedException('Failed to get user profile');
      }

      if (!data.user) {
        throw new UnauthorizedException('User not found');
      }

      const profile: UserProfile = {
        id: data.user.id,
        email: data.user.email!,
        fullName: data.user.user_metadata?.full_name || data.user.user_metadata?.name,
        avatarUrl: data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture,
        provider: data.user.app_metadata?.provider || 'google',
        createdAt: data.user.created_at,
        lastSignInAt: data.user.last_sign_in_at,
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
      // Supabase 클라이언트에 토큰 설정
      await this.supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: '', // 로그아웃 시에는 refresh token이 필요하지 않음
      });

      const { error } = await this.supabase.auth.signOut();

      if (error) {
        this.logger.error('Logout failed:', error);
        throw new UnauthorizedException('Logout failed');
      }

      this.logger.log('User logged out successfully');
    } catch (error) {
      this.logger.error('Logout error:', error);
      
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
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