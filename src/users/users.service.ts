import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  EntityManager,
  EntityRepository,
  LockMode,
} from '@mikro-orm/postgresql';
import { User, UserRole } from './entities/user.entity';
import { UserOAuth, OAuthProvider } from './entities/user-oauth.entity';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  UserIdentifierLike,
  buildUserFilterFromInput,
  ensureUserIdentifier,
  isUuid,
} from './utils/user-identifier.util';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { Tag } from '../tags/entities/tag.entity';
import { ArticleScrap } from '../articles/entities/article-scrap.entity';
import { ArticleArchive } from '../article-archive/entities/article-archive.entity';
import { Article } from '../articles/entities/article.entity';
import { WritingStyleExample } from '../writing-styles/entities/writing-style-example.entity';
import { WritingStyle } from '../writing-styles/entities/writing-style.entity';
import { Scrap } from '../scraps/entities/scrap.entity';
import { Job } from '../queue/entities/job-status.entity';
import { Folder } from '../folders/entities/folder.entity';
import { AccountDeletionAudit } from './entities/account-deletion-audit.entity';
import { PendingS3Deletion } from './entities/pending-s3-deletion.entity';
// Analytics tracking migrated to extension client (PostHog). Server no longer emits events.

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

/**
 * 계정 삭제 옵션
 */
export interface DeleteAccountOptions {
  deletedBy: 'self' | 'admin';
  adminId?: string;
  skipS3Cleanup?: boolean; // 테스트용
}

/**
 * 계정 삭제 결과
 */
export interface DeleteAccountResult {
  success: boolean;
  deletedCounts: {
    tags: number;
    articleScraps: number;
    articleArchives: number;
    articles: number;
    writingStyleExamples: number;
    writingStyles: number;
    scraps: number;
    jobs: number;
    folders: number;
    userOAuths: number;
  };
  s3FilesDeleted: number;
  errors: string[];
}

@Injectable()
export class UsersService {
  private readonly s3Client: S3Client;

  constructor(
    private readonly em: EntityManager,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    @InjectRepository(UserOAuth)
    private readonly userOAuthRepository: EntityRepository<UserOAuth>,
    @InjectRepository(PendingS3Deletion)
    private readonly pendingS3DeletionRepository: EntityRepository<PendingS3Deletion>,
    private readonly configService: ConfigService,
  ) {
    const awsRegion = this.configService.get<string>('AWS_REGION', 'us-east-1');
    const awsAccessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const awsSecretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    this.s3Client = new S3Client({
      region: awsRegion,
      credentials:
        awsAccessKeyId && awsSecretAccessKey
          ? {
              accessKeyId: awsAccessKeyId,
              secretAccessKey: awsSecretAccessKey,
            }
          : undefined,
    });
  }

  async findOne(id: UserIdentifierLike): Promise<User | null> {
    if (id === null || id === undefined) {
      return null;
    }

    return await this.userRepository.findOne(
      buildUserFilterFromInput(id),
      { populate: ['oauthAccounts'] },
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne(
      { email },
      { populate: ['oauthAccounts'] },
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
  async findByOAuthId(
    provider: OAuthProvider,
    oauthId: string,
  ): Promise<User | null> {
    const userOAuth = await this.userOAuthRepository.findOne(
      { oauthProvider: provider, oauthId },
      { populate: ['user', 'user.oauthAccounts'] },
    );
    return userOAuth?.user || null;
  }

  /**
   * OAuth를 통한 사용자 생성 또는 업데이트
   */
  async createOrUpdateOAuthUser(
    data: CreateOAuthUserData,
  ): Promise<{ user: User; isNewUser: boolean }> {
    // 1. 기존 OAuth 계정 확인
    const existingOAuth = await this.userOAuthRepository.findOne(
      { oauthProvider: data.oauthProvider, oauthId: data.oauthId },
      { populate: ['user'] },
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
      return { user, isNewUser: false };
    }

    // 2. 이메일로 기존 사용자 확인
    let user = await this.findByEmail(data.email);
    let isNewUser = false;

    if (!user) {
      // 새 사용자 생성
      user = new User();
      user.email = data.email;
      user.name = data.name;
      user.role = UserRole.USER;
      await this.em.persistAndFlush(user);
      isNewUser = true;

      // Event tracking moved to client
    }

    // 3. OAuth 계정 연결
    const userOAuth = new UserOAuth({
      oauthProvider: data.oauthProvider,
      oauthId: data.oauthId,
      user: user,
      profileData: data.profileData,
    });

    await this.em.persistAndFlush([userOAuth, user]);

    // 4. 사용자 정보 다시 로드 (OAuth 계정 포함)
    const fullUser = (await this.findOne(user.userId)) as User;
    return { user: fullUser, isNewUser };
  }

  /**
   * OAuth 토큰 업데이트
   */
  async updateOAuthTokens(
    provider: OAuthProvider,
    oauthId: string,
    tokenData: UpdateOAuthTokenData,
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
  async getUserOAuthAccounts(
    userId: UserIdentifierLike,
  ): Promise<UserOAuth[]> {
    const user = await this.findOne(userId);
    if (!user) {
      return [];
    }
    return await this.userOAuthRepository.find({ user });
  }

  /**
   * OAuth 계정 제거
   */
  async removeOAuthAccount(
    provider: OAuthProvider,
    oauthId: string,
  ): Promise<boolean> {
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
      { populate: ['user', 'user.oauthAccounts'] },
    );
    return userOAuth?.user || null;
  }

  /**
   * 사용자 정보 업데이트
   */
  async updateUser(
    userId: UserIdentifierLike,
    updateData: Partial<{ email: string; name: string }>,
  ): Promise<User | null> {
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

  async resolveCanonicalUserId(
    identifier: UserIdentifierLike,
    { throwOnNotFound = true }: { throwOnNotFound?: boolean } = {},
  ): Promise<string | null> {
    const normalized = ensureUserIdentifier(identifier);

    if (typeof normalized === 'string' && isUuid(normalized)) {
      return normalized.toLowerCase();
    }

    const user = await this.userRepository.findOne(
      buildUserFilterFromInput(normalized),
    );

    if (!user) {
      if (throwOnNotFound) {
        throw new NotFoundException('User not found');
      }
      return null;
    }

    return user.userId;
  }

  /**
   * 사용자 계정과 모든 관련 데이터 삭제 (GDPR 준수)
   * 트랜잭션 기반으로 안전하게 삭제하며, 실패 시 자동 롤백
   * 보상 트랜잭션 패턴으로 S3 삭제 실패 시에도 추적 및 재시도 가능
   */
  async deleteAccount(
    userId: string,
    options: DeleteAccountOptions,
  ): Promise<DeleteAccountResult> {
    const result: DeleteAccountResult = {
      success: false,
      deletedCounts: {
        tags: 0,
        articleScraps: 0,
        articleArchives: 0,
        articles: 0,
        writingStyleExamples: 0,
        writingStyles: 0,
        scraps: 0,
        jobs: 0,
        folders: 0,
        userOAuths: 0,
      },
      s3FilesDeleted: 0,
      errors: [],
    };

    await this.validateAccountDeletion(userId, options);

    const bucketName = this.configService.get<string>('AWS_S3_BUCKET');
    let userEmail = '';
    const pendingS3Records: PendingS3Deletion[] = [];

    try {
      // 트랜잭션 내에서 모든 DB 작업 + S3 삭제 추적 레코드 생성
      await this.em.transactional(
        async (em) => {
          const user = await em.findOne(
            User,
            { userId },
            { lockMode: LockMode.PESSIMISTIC_WRITE },
          );

          if (!user) {
            throw new BadRequestException('User not found');
          }

          // 트랜잭션 내에서 user email 한 번만 조회 (race condition 방지)
          userEmail = user.email;

          // S3 파일 경로 수집 및 추적 레코드 생성 (트랜잭션 내)
          if (!options.skipS3Cleanup && bucketName) {
            const s3FilePaths = await this.collectS3FilePathsInTransaction(
              em,
              user,
            );

            for (const filePath of s3FilePaths) {
              const [, ...keyParts] = filePath.split('/');
              const key = keyParts.join('/');

              const pendingRecord = new PendingS3Deletion();
              pendingRecord.userId = userId;
              pendingRecord.s3Key = key;
              pendingRecord.bucketName = bucketName;
              pendingRecord.status = 'pending';
              pendingRecord.retryCount = 0;

              em.persist(pendingRecord);
              pendingS3Records.push(pendingRecord);
            }
          }

          // 연관 엔티티 삭제
          result.deletedCounts.tags = await this.deleteTags(em, user);
          result.deletedCounts.articleScraps = await this.deleteArticleScraps(
            em,
            user,
          );
          result.deletedCounts.articleArchives =
            await this.deleteArticleArchives(em, user);
          result.deletedCounts.articles = await em.nativeDelete(Article, {
            user,
          });
          result.deletedCounts.writingStyleExamples =
            await this.deleteWritingStyleExamples(em, user);
          result.deletedCounts.writingStyles = await em.nativeDelete(
            WritingStyle,
            { user },
          );
          result.deletedCounts.scraps = await em.nativeDelete(Scrap, { user });
          result.deletedCounts.jobs = await em.nativeDelete(Job, { userId });
          await this.deleteFoldersRecursively(em, user);
          result.deletedCounts.folders = await em.nativeDelete(Folder, {
            user,
          });
          result.deletedCounts.userOAuths = await em.nativeDelete(UserOAuth, {
            user,
          });

          await em.removeAndFlush(user);
        },
        { timeout: 120000 },
      ); // 120초 타임아웃 설정

      result.success = true;

      // 트랜잭션 커밋 후 S3 삭제 시도 (보상 트랜잭션)
      if (pendingS3Records.length > 0) {
        result.s3FilesDeleted = await this.processS3DeletionsWithTracking(
          pendingS3Records,
          result.errors,
        );
      }

      // 감사 로그 실패 시 예외 발생 (컴플라이언스 요구사항)
      await this.logAccountDeletion(userId, userEmail, options, result);

      return result;
    } catch (error) {
      result.errors.push(error.message || 'Unknown error during deletion');
      throw error;
    }
  }

  private async validateAccountDeletion(
    userId: string,
    options: DeleteAccountOptions,
  ): Promise<void> {
    const user = await this.findOne(userId);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (options.deletedBy === 'admin' && user.role === UserRole.ADMIN) {
      throw new ForbiddenException(
        'Cannot delete admin accounts via admin API',
      );
    }
  }

  /**
   * 트랜잭션 내에서 S3 파일 경로 수집
   */
  private async collectS3FilePathsInTransaction(
    em: EntityManager,
    user: User,
  ): Promise<string[]> {
    const scraps = await em.find(Scrap, {
      user,
      filePath: { $ne: null },
    });

    return scraps
      .filter((scrap) => scrap.filePath && scrap.filePath.startsWith('s3://'))
      .map((scrap) => scrap.filePath!.replace('s3://', ''));
  }

  private async deleteTags(em: EntityManager, user: User): Promise<number> {
    return await em.nativeDelete(Tag, { user });
  }

  private async deleteArticleScraps(
    em: EntityManager,
    user: User,
  ): Promise<number> {
    const articleScrapIds = await em
      .createQueryBuilder(ArticleScrap, 'as')
      .select('as.articleScrapId')
      .join('as.article', 'a')
      .where({ 'a.user': user })
      .getResult();

    if (articleScrapIds.length === 0) {
      return 0;
    }

    return await em.nativeDelete(ArticleScrap, {
      articleScrapId: { $in: articleScrapIds.map((as) => as.articleScrapId) },
    });
  }

  private async deleteArticleArchives(
    em: EntityManager,
    user: User,
  ): Promise<number> {
    const articleArchiveIds = await em
      .createQueryBuilder(ArticleArchive, 'aa')
      .select('aa.articleArchiveId')
      .join('aa.article', 'a')
      .where({ 'a.user': user })
      .getResult();

    if (articleArchiveIds.length === 0) {
      return 0;
    }

    return await em.nativeDelete(ArticleArchive, {
      articleArchiveId: {
        $in: articleArchiveIds.map((aa) => aa.articleArchiveId),
      },
    });
  }

  private async deleteWritingStyleExamples(
    em: EntityManager,
    user: User,
  ): Promise<number> {
    const writingStyleIds = await em
      .createQueryBuilder(WritingStyle, 'ws')
      .select('ws.id')
      .where({ user })
      .getResult();

    if (writingStyleIds.length === 0) {
      return 0;
    }

    return await em.nativeDelete(WritingStyleExample, {
      writingStyle: { $in: writingStyleIds.map((ws) => ws.id) },
    });
  }

  private async deleteFoldersRecursively(
    em: EntityManager,
    user: User,
  ): Promise<void> {
    await em.nativeUpdate(Folder, { user }, { parentFolder: null });
  }

  /**
   * S3 파일 삭제를 추적 레코드와 함께 처리 (보상 트랜잭션)
   * 성공 시 레코드를 'completed'로 마크, 실패 시 'pending' 유지 및 에러 기록
   */
  private async processS3DeletionsWithTracking(
    pendingRecords: PendingS3Deletion[],
    errors: string[],
  ): Promise<number> {
    let deletedCount = 0;

    for (const record of pendingRecords) {
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: record.bucketName,
            Key: record.s3Key,
          }),
        );

        // 성공 시 레코드를 'completed'로 업데이트
        record.status = 'completed';
        await this.em.persistAndFlush(record);
        deletedCount++;
      } catch (error) {
        const errorMessage = `Failed to delete S3 file ${record.bucketName}/${record.s3Key}: ${error.message}`;
        errors.push(errorMessage);

        // 실패 시 에러 정보 업데이트 (다음 재시도를 위해 'pending' 유지)
        record.lastError = errorMessage;
        record.retryCount += 1;
        record.nextRetryAt = new Date(
          Date.now() + Math.pow(2, record.retryCount) * 60000,
        ); // 지수 백오프

        try {
          await this.em.persistAndFlush(record);
        } catch (updateError) {
          console.error(
            'Failed to update pending S3 deletion record:',
            updateError,
          );
        }
      }
    }

    return deletedCount;
  }

  /**
   * 계정 삭제 감사 로그 기록
   * 컴플라이언스 요구사항: 실패 시 예외를 발생시켜 상위에서 처리하도록 함
   */
  private async logAccountDeletion(
    userId: string,
    userEmail: string,
    options: DeleteAccountOptions,
    result: DeleteAccountResult,
  ): Promise<void> {
    const auditLog = new AccountDeletionAudit();
    auditLog.userId = userId;
    auditLog.userEmail = userEmail;
    auditLog.deletedBy = options.deletedBy;
    auditLog.adminId = options.adminId;
    auditLog.deletedEntityCounts = result.deletedCounts;
    auditLog.s3FilesDeleted = result.s3FilesDeleted;
    auditLog.errors = result.errors.length > 0 ? result.errors : undefined;

    // 감사 로그 저장 실패 시 예외 발생 (컴플라이언스 요구사항)
    await this.em.persistAndFlush(auditLog);

    console.log({
      event: 'ACCOUNT_DELETED',
      userId,
      userEmail,
      deletedBy: options.deletedBy,
      adminId: options.adminId,
      timestamp: new Date(),
      deletedEntityCounts: result.deletedCounts,
      s3FilesDeleted: result.s3FilesDeleted,
      errors: result.errors,
    });
  }
}
