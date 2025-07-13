/**
 * 인증 컨트롤러
 * 
 * @description Supabase Google OAuth 인증을 위한 REST API 엔드포인트를 제공합니다.
 * Linear issue CHI-40 요구사항에 따라 구현되었습니다.
 */

import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  Version,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthService, GoogleAuthDto, AuthResponse, ChromeExtensionTokenDto } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthenticatedUser } from './strategies/jwt.strategy';

/**
 * Google OAuth 인증 요청 DTO
 */
export class GoogleAuthRequestDto {
  code: string;
  redirectUri: string;
}

/**
 * 토큰 갱신 요청 DTO
 */
export class RefreshTokenDto {
  refreshToken: string;
}

/**
 * 크롬 익스텐션 OAuth 토큰 DTO
 */
export class ChromeExtensionAuthDto {
  accessToken: string;
  provider: 'google';
  extensionId?: string;
}

/**
 * Express Request에 user 정보를 추가하는 인터페이스
 */
interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * 크롬 익스텐션용 OAuth 설정 조회
   */
  @Get('chrome-extension/config')
  @ApiOperation({ 
    summary: '크롬 익스텐션용 OAuth 설정 조회',
    description: '크롬 익스텐션에서 Chrome Identity API 사용을 위한 OAuth 설정을 반환합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '크롬 익스텐션 OAuth 설정 조회 성공',
    schema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', example: 'your-google-client-id' },
        scopes: { type: 'array', items: { type: 'string' }, example: ['openid', 'email', 'profile'] },
        redirectUri: { type: 'string', example: 'chrome-extension://extension-id/auth/callback' }
      }
    }
  })
  async getChromeExtensionOAuthConfig() {
    this.logger.log('Getting Chrome Extension OAuth config');
    
    return this.authService.getChromeExtensionOAuthConfig();
  }

  /**
   * 크롬 익스텐션 OAuth 인증
   */
  @Version('1')
  @Post('chrome-extension/auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: '크롬 익스텐션 OAuth 인증',
    description: 'Chrome Identity API로 받은 토큰을 사용하여 JWT 토큰을 발급받습니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '크롬 익스텐션 OAuth 인증 성공',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            fullName: { type: 'string' },
            avatarUrl: { type: 'string' },
            provider: { type: 'string' }
          }
        },
        expiresAt: { type: 'number' }
      }
    }
  })
  @ApiResponse({ status: 401, description: '크롬 익스텐션 OAuth 인증 실패' })
  async authenticateWithChromeExtension(@Body() authDto: ChromeExtensionAuthDto): Promise<AuthResponse> {
    this.logger.log('Processing Chrome Extension OAuth authentication', { 
      provider: authDto.provider,
      extensionId: authDto.extensionId 
    });
    
    return await this.authService.authenticateWithChromeExtension(authDto);
  }

  /**
   * Google OAuth URL 생성 (일반 웹 앱용)
   */
  @Get('google/url')
  @ApiOperation({ 
    summary: 'Google OAuth URL 생성 (웹 앱용)',
    description: '일반 웹 애플리케이션용 Google OAuth 인증을 위한 URL을 생성합니다.'
  })
  @ApiQuery({
    name: 'redirectUri',
    description: '인증 완료 후 리디렉션될 URI',
    required: true,
    example: 'http://localhost:3000/auth/callback'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Google OAuth URL 생성 성공',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', example: 'https://accounts.google.com/oauth/authorize?...' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'OAuth URL 생성 실패' })
  async getGoogleOAuthUrl(@Query('redirectUri') redirectUri: string) {
    this.logger.log('Generating Google OAuth URL', { redirectUri });
    
    return await this.authService.getGoogleOAuthUrl(redirectUri);
  }

  /**
   * Google OAuth 코드로 인증
   */
  @Post('google/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Google OAuth 인증',
    description: 'Google OAuth 인증 코드를 사용하여 JWT 토큰을 발급받습니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Google OAuth 인증 성공',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            fullName: { type: 'string' },
            avatarUrl: { type: 'string' },
            provider: { type: 'string' }
          }
        },
        expiresAt: { type: 'number' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Google OAuth 인증 실패' })
  async authenticateWithGoogle(@Body() authDto: GoogleAuthRequestDto): Promise<AuthResponse> {
    this.logger.log('Processing Google OAuth authentication', { 
      redirectUri: authDto.redirectUri 
    });
    
    return await this.authService.authenticateWithGoogle(authDto);
  }

  /**
   * 토큰 갱신
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: '토큰 갱신',
    description: 'Refresh token을 사용하여 새로운 Access token을 발급받습니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '토큰 갱신 성공',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            fullName: { type: 'string' },
            avatarUrl: { type: 'string' },
            provider: { type: 'string' }
          }
        },
        expiresAt: { type: 'number' }
      }
    }
  })
  @ApiResponse({ status: 401, description: '토큰 갱신 실패' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto): Promise<AuthResponse> {
    this.logger.log('Processing token refresh');
    
    return await this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  /**
   * 현재 사용자 정보 조회
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: '사용자 프로필 조회',
    description: '현재 인증된 사용자의 프로필 정보를 조회합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '사용자 프로필 조회 성공',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        fullName: { type: 'string' },
        avatarUrl: { type: 'string' },
        provider: { type: 'string' },
        createdAt: { type: 'string' },
        lastSignInAt: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 401, description: '인증되지 않은 사용자' })
  async getProfile(@Request() req: RequestWithUser) {
    this.logger.log('Getting user profile', { userId: req.user.id });
    
    return await this.authService.getUserProfile(req.user.id);
  }

  /**
   * 로그아웃
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: '로그아웃',
    description: '현재 사용자를 로그아웃 처리합니다.'
  })
  @ApiResponse({ status: 200, description: '로그아웃 성공' })
  @ApiResponse({ status: 401, description: '인증되지 않은 사용자' })
  async logout(@Request() req: RequestWithUser) {
    this.logger.log('Processing logout', { userId: req.user.id });
    
    // Authorization 헤더에서 토큰 추출
    const authHeader = req.headers['authorization'];
    const token = authHeader?.substring(7); // "Bearer " 제거
    
    if (!token) {
      this.logger.warn('No token found in logout request');
      return { message: 'Logout successful' };
    }
    
    await this.authService.logout(token);
    
    return { message: 'Logout successful' };
  }

  /**
   * 인증 상태 확인
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: '인증 상태 확인',
    description: '현재 사용자의 인증 상태를 확인합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '인증 상태 확인 성공',
    schema: {
      type: 'object',
      properties: {
        authenticated: { type: 'boolean' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string' },
            metadata: {
              type: 'object',
              properties: {
                fullName: { type: 'string' },
                avatarUrl: { type: 'string' },
                provider: { type: 'string' }
              }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: '인증되지 않은 사용자' })
  async getStatus(@Request() req: RequestWithUser) {
    this.logger.log('Checking authentication status', { userId: req.user.id });
    
    return {
      authenticated: true,
      user: req.user,
    };
  }

  /**
   * 테스트 엔드포인트 (인증 없이 접근 가능)
   */
  @Get('test')
  @ApiOperation({ 
    summary: '인증 모듈 테스트',
    description: '인증 모듈의 기본 동작을 테스트합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '테스트 성공',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        timestamp: { type: 'string' },
        environment: { type: 'string' }
      }
    }
  })
  async test() {
    return {
      message: 'Authentication module is working',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    };
  }
} 