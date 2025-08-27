import { Injectable } from '@nestjs/common';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { User } from './entities/user.entity';
import { UserOAuth, OAuthProvider } from './entities/user-oauth.entity';
import { InjectRepository } from '@mikro-orm/nestjs';

/**
 * OAuth 사용자 생성 데이터
 */
export interface CreateOAuthUserData {
  email: string;
  name: string;
  oauthProvider: OAuthProvider;
  oauthId: string;
  profileData?: any;
}

/**
 * OAuth 토큰 업데이트 데이터
 */
export interface UpdateOAuthTokenData {
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    @InjectRepository(UserOAuth)
    private readonly userOAuthRepository: EntityRepository<UserOAuth>,
  ) {}

  async findOne(id: number): Promise<User | null> {
    return await this.userRepository.findOne(
      { userId: id },
      { populate: ['oauthAccounts'] }
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne(
      { email },
      { populate: ['oauthAccounts'] }
    );
  }

  async create(userData: { email: string; name: string }): Promise<User> {
    const user = new User();
    Object.assign(user, userData);
    await this.em.persistAndFlush(user);
    return user;
  }

  /**
   * OAuth ID로 사용자 조회
   */
  async findByOAuthId(provider: OAuthProvider, oauthId: string): Promise<User | null> {
    const userOAuth = await this.userOAuthRepository.findOne(
      { oauthProvider: provider, oauthId },
      { populate: ['user', 'user.oauthAccounts'] }
    );
    return userOAuth?.user || null;
  }

  /**
   * OAuth를 통한 사용자 생성 또는 업데이트
   */
  async createOrUpdateOAuthUser(data: CreateOAuthUserData): Promise<User> {
    // 1. 기존 OAuth 계정 확인
    let existingOAuth = await this.userOAuthRepository.findOne(
      { oauthProvider: data.oauthProvider, oauthId: data.oauthId },
      { populate: ['user'] }
    );

    if (existingOAuth) {
      // 기존 OAuth 계정이 있으면 프로필 데이터 업데이트
      existingOAuth.profileData = data.profileData;
      existingOAuth.updatedAt = new Date();
      
      // 사용자 정보도 업데이트 (이메일이나 이름이 변경되었을 수 있음)
      const user = existingOAuth.user;
      if (user.email !== data.email || user.name !== data.name) {
        user.email = data.email;
        user.name = data.name;
        user.updatedAt = new Date();
      }
      
      await this.em.persistAndFlush([existingOAuth, user]);
      return user;
    }

    // 2. 이메일로 기존 사용자 확인
    let user = await this.findByEmail(data.email);
    
    if (!user) {
      // 새 사용자 생성
      user = new User();
      user.email = data.email;
      user.name = data.name;
      await this.em.persistAndFlush(user);
    }

    // 3. OAuth 계정 연결
    const userOAuth = new UserOAuth({
      oauthProvider: data.oauthProvider,
      oauthId: data.oauthId,
      user: user,
      profileData: data.profileData,
    });

    await this.em.persistAndFlush(userOAuth);
    
    // 4. 사용자 정보 다시 로드 (OAuth 계정 포함)
    return await this.findOne(user.userId) as User;
  }

  /**
   * OAuth 토큰 업데이트
   */
  async updateOAuthTokens(
    provider: OAuthProvider, 
    oauthId: string, 
    tokenData: UpdateOAuthTokenData
  ): Promise<UserOAuth | null> {
    const userOAuth = await this.userOAuthRepository.findOne({
      oauthProvider: provider,
      oauthId,
    });

    if (!userOAuth) {
      return null;
    }

    if (tokenData.accessToken) {
      userOAuth.accessToken = tokenData.accessToken;
    }
    if (tokenData.refreshToken) {
      userOAuth.refreshToken = tokenData.refreshToken;
    }
    if (tokenData.tokenExpiresAt) {
      userOAuth.tokenExpiresAt = tokenData.tokenExpiresAt;
    }
    
    userOAuth.updatedAt = new Date();
    await this.em.persistAndFlush(userOAuth);
    
    return userOAuth;
  }

  /**
   * 사용자의 OAuth 계정 조회
   */
  async getUserOAuthAccounts(userId: number): Promise<UserOAuth[]> {
    const user = await this.findOne(userId);
    if (!user) {
      return [];
    }
    return await this.userOAuthRepository.find({ user });
  }

  /**
   * OAuth 계정 제거
   */
  async removeOAuthAccount(provider: OAuthProvider, oauthId: string): Promise<boolean> {
    const userOAuth = await this.userOAuthRepository.findOne({
      oauthProvider: provider,
      oauthId,
    });

    if (!userOAuth) {
      return false;
    }

    await this.em.removeAndFlush(userOAuth);
    return true;
  }

  /**
   * 사용자 UUID로 조회 (JWT의 sub 필드용)
   */
  async findByUuid(uuid: string): Promise<User | null> {
    // UUID는 OAuth ID로 저장되므로 OAuth 테이블에서 조회
    const userOAuth = await this.userOAuthRepository.findOne(
      { oauthId: uuid },
      { populate: ['user', 'user.oauthAccounts'] }
    );
    return userOAuth?.user || null;
  }

  /**
   * 사용자 정보 업데이트
   */
  async updateUser(userId: number, updateData: Partial<{ email: string; name: string }>): Promise<User | null> {
    const user = await this.findOne(userId);
    if (!user) {
      return null;
    }

    if (updateData.email) {
      user.email = updateData.email;
    }
    if (updateData.name) {
      user.name = updateData.name;
    }
    
    user.updatedAt = new Date();
    await this.em.persistAndFlush(user);
    
    return user;
  }
} 