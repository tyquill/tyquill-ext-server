/**
 * UserOAuth 엔티티
 * 
 * @description OAuth 인증 정보를 저장하는 엔티티입니다.
 * 한 사용자가 여러 OAuth 제공자(Google, GitHub 등)로 로그인할 수 있도록 지원합니다.
 */

import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core';
import { User } from './user.entity';

/**
 * OAuth 제공자 타입
 */
export enum OAuthProvider {
  GOOGLE = 'google',
  GITHUB = 'github',
  FACEBOOK = 'facebook',
  APPLE = 'apple',
}

@Entity({ tableName: 'user_oauth' })
@Unique({ properties: ['oauthProvider', 'oauthId'] }) // 같은 제공자의 같은 ID는 중복 불가
export class UserOAuth {
  @PrimaryKey({ name: 'user_oauth_id' })
  userOauthId: number;

  @Property({ 
    name: 'oauth_provider', 
    length: 50,
    comment: 'OAuth 제공자 (Google/GitHub/etc)'
  })
  oauthProvider: OAuthProvider;

  @Property({ 
    name: 'oauth_id', 
    length: 255,
    comment: 'OAuth 고유 ID (sub 필드 값)'
  })
  oauthId: string;

  @Property({ 
    name: 'access_token',
    length: 1000,
    nullable: true,
    comment: 'OAuth Access Token (필요시)'
  })
  accessToken?: string;

  @Property({ 
    name: 'refresh_token',
    length: 1000,
    nullable: true,
    comment: 'OAuth Refresh Token (필요시)'
  })
  refreshToken?: string;

  @Property({ 
    name: 'token_expires_at',
    nullable: true,
    comment: '토큰 만료 시간'
  })
  tokenExpiresAt?: Date;

  @Property({ 
    name: 'created_at',
    comment: '생성일시'
  })
  createdAt: Date = new Date();

  @Property({ 
    name: 'updated_at', 
    onUpdate: () => new Date(),
    comment: '수정일시'
  })
  updatedAt: Date = new Date();

  @ManyToOne(() => User, { fieldName: 'user_id' })
  user: User;

  /**
   * OAuth 제공자별 프로필 정보 (JSON)
   */
  @Property({ 
    name: 'profile_data',
    type: 'json',
    nullable: true,
    comment: 'OAuth 제공자에서 받은 프로필 정보'
  })
  profileData?: {
    email?: string;
    name?: string;
    picture?: string;
    locale?: string;
    verified_email?: boolean;
    [key: string]: any;
  };

  constructor(data?: Partial<UserOAuth>) {
    if (data) {
      Object.assign(this, data);
    }
  }

  /**
   * 토큰이 만료되었는지 확인
   */
  isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) {
      return false;
    }
    return new Date() > this.tokenExpiresAt;
  }

  /**
   * 프로필 정보에서 이메일 추출
   */
  getEmailFromProfile(): string | null {
    return this.profileData?.email || null;
  }

  /**
   * 프로필 정보에서 이름 추출
   */
  getNameFromProfile(): string | null {
    return this.profileData?.name || null;
  }

  /**
   * 프로필 정보에서 아바타 URL 추출
   */
  getAvatarFromProfile(): string | null {
    return this.profileData?.picture || null;
  }
} 