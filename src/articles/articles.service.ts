import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CreateArticleDto } from '../api/articles/dto/create-article.dto';
import {
  GenerateArticleDto,
  GenerateArticleResponse,
  ScrapWithOptionalComment,
} from '../api/articles/dto/generate-article.dto';
import {
  GenerateArticleV2Dto,
  GenerateArticleV2Response,
  ArticleStatusV2Response,
} from '../api/articles/dto/generate-article-v2.dto';
import { GenerateArticleV3Dto } from '../api/articles/dto/generate-article-v3.dto';
import { RegenerateArticleV3Dto } from '../api/articles/dto/regenerate-article-v3.dto';
import { UpdateArticleDto } from '../api/articles/dto/update-article.dto';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Article } from './entities/article.entity';
import { ArticleArchive } from '../article-archive/entities/article-archive.entity';
import { ArticleScrap } from './entities/article-scrap.entity';
import { Scrap } from '../scraps/entities/scrap.entity';
import { User } from '../users/entities/user.entity';
import { Folder } from '../folders/entities/folder.entity';
import { EntityManager, EntityRepository, LockMode } from '@mikro-orm/core';
import { NewsletterAgentService } from '../agents/services/newsletter-agent.service';
import { SlackService } from '../notifications/slack.service';
import { WritingStyle } from '../writing-styles/entities/writing-style.entity';
import { WritingStyleExample } from 'src/writing-styles/entities/writing-style-example.entity';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { EventType } from '../ai-workflows/models/streaming';
import { RegenerateArticleOutput } from '../ai-workflows/dto/regenerate.dto';
import {
  ArticleIdentifierLike,
  ensureArticleIdentifier,
  buildArticleFilterFromInput,
  isUuid,
} from './utils/article-identifier.util';
import {
  ScrapIdentifier,
  isUuid as isScrapUuid,
} from '../scraps/utils/scrap-identifier.util';
import { FilterQuery } from '@mikro-orm/core';
// Analytics tracking migrated to extension client (PostHog).

@Injectable()
export class ArticlesService {
  private readonly logger = new Logger(ArticlesService.name);

  constructor(
    private readonly em: EntityManager,
    @InjectRepository(Article)
    private readonly articleRepository: EntityRepository<Article>,
    @InjectRepository(ArticleArchive)
    private readonly articleArchiveRepository: EntityRepository<ArticleArchive>,
    @InjectRepository(ArticleScrap)
    private readonly articleScrapRepository: EntityRepository<ArticleScrap>,
    @InjectRepository(Scrap)
    private readonly scrapRepository: EntityRepository<Scrap>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    @InjectRepository(Folder)
    private readonly folderRepository: EntityRepository<Folder>,
    @InjectRepository(WritingStyle)
    private readonly writingStyleRepository: EntityRepository<WritingStyle>,
    private readonly newsletterAgentService: NewsletterAgentService,
    private readonly slackService: SlackService,
    @InjectRepository(WritingStyleExample)
    private readonly writingStyleExampleRepository: EntityRepository<WritingStyleExample>,
    // Uploaded files are represented as scraps with file metadata
  ) {}

  /**
   * 페이지 콘텐츠를 분석하여 구조화된 템플릿을 반환합니다.
   */
  async analyzePageStructure(content: string): Promise<any> {
    console.log('analyzePageStructure');
    const result =
      await this.newsletterAgentService.analyzePageStructure(content);

    try {
      // LLM의 결과물이 항상 완벽한 JSON이 아닐 수 있으므로 파싱 시도
      console.log(result);
      const jsonResult = JSON.stringify(result);
      return jsonResult;
    } catch (error) {
      console.error('Failed to parse structure analysis result:', error);
      // 파싱 실패 시, 원본 텍스트를 기반으로 한 대체 구조 반환
      return [
        {
          title: '분석된 내용',
          description: 'AI가 페이지 내용을 분석했습니다.',
        },
      ];
    }
  }

  /**
   * 아티클 생성
   */
  async create(
    userId: string,
    createArticleDto: CreateArticleDto,
  ): Promise<Article> {
    const user = await this.getUserOrThrow(userId);

    const article = new Article();
    article.topic = createArticleDto.topic;
    article.keyInsight = createArticleDto.keyInsights;
    article.generationParams = createArticleDto.generationParams;
    article.user = user;

    // Handle folder assignment
    if (createArticleDto.folderId) {
      const folder = await this.folderRepository.findOne({
        folderId: createArticleDto.folderId,
        user: user,
      });
      if (folder) {
        article.folder = folder;
      }
    }

    await this.em.persistAndFlush(article);

    // title과 content가 있으면 article_archive에 저장
    if (createArticleDto.title || createArticleDto.content) {
      const archive = new ArticleArchive();
      archive.title = createArticleDto.title || article.topic;
      archive.content = createArticleDto.content || '내용 없음';
      archive.versionNumber = 1;
      archive.article = article;
      await this.em.persistAndFlush(archive);
    }

    return article;
  }

  /**
   * AI 기반 아티클 생성
   */
  async generateArticle(
    userId: string,
    generateDto: GenerateArticleDto,
  ): Promise<GenerateArticleResponse> {
    // 사용자 검증
    const user = await this.getUserOrThrow(userId);
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    // Removed: first-completion existence check (using generic activity events)

    // 스크랩 데이터 준비
    let scrapsWithComments: Array<{ scrap: Scrap; userComment?: string }> = [];

    if (
      generateDto.scrapWithOptionalComment &&
      generateDto.scrapWithOptionalComment.length > 0
    ) {
      const scraps = await this.scrapRepository.find({
        scrapId: {
          $in: generateDto.scrapWithOptionalComment.map(
            (comment) => comment.scrapId,
          ),
        },
        user: user,
        isDeleted: false,
      });

      scrapsWithComments = scraps.map((scrap) => {
        const scrapComment = generateDto.scrapWithOptionalComment?.find(
          (comment: ScrapWithOptionalComment) =>
            comment.scrapId === scrap.scrapId,
        );

        return {
          scrap,
          userComment: scrapComment?.userComment,
        };
      });
    }

    let writingStyleExampleContents: string[] = [];
    if (generateDto.writingStyleId) {
      const writingStyleExamples =
        await this.writingStyleExampleRepository.find(
          { writingStyle: { id: generateDto.writingStyleId, user: user } },
          { populate: ['writingStyle'] },
        );
      writingStyleExampleContents = writingStyleExamples.map(
        (example) => example.content,
      );
      if (!writingStyleExamples) {
        throw new NotFoundException('쓰기 스타일을 찾을 수 없습니다.');
      }
    }

    // Convert scrapsWithComments to the format expected by FastAPI
    const formattedScrapsWithComments = scrapsWithComments.map((item) => ({
      scrap: {
        id: item.scrap.scrapId,
        title: item.scrap.title,
        url: item.scrap.url,
        content: item.scrap.content,
        userComment: item.scrap.userComment,
      },
      userComment: item.userComment,
    }));

    // AI 뉴스레터 생성
    const newsletterResult =
      await this.newsletterAgentService.generateNewsletter({
        topic: generateDto.topic,
        keyInsight: generateDto.keyInsight,
        scrapsWithComments: formattedScrapsWithComments,
        generationParams: generateDto.generationParams,
        articleStructureTemplate: generateDto.articleStructureTemplate,
        writingStyleExampleContents,
      });

    // 아티클 저장
    const article = new Article();
    article.topic = generateDto.topic;
    article.keyInsight = generateDto.keyInsight;
    article.generationParams = generateDto.generationParams;
    article.user = user;

    await this.em.persistAndFlush(article);

    // AI 생성 결과를 아카이브에 저장
    const archive = new ArticleArchive();
    archive.title = newsletterResult.title;
    archive.content = newsletterResult.content;
    archive.versionNumber = 1;
    archive.article = article;
    await this.em.persistAndFlush(archive);

    // Event tracking moved to client

    // Send Slack notification for successful article generation
    const generationStartTime = Date.now();
    try {
      await this.slackService.notifyArticleGeneration({
        articleId: article.articleId,
        title: newsletterResult.title,
        topic: generateDto.topic,
        keyInsight: generateDto.keyInsight,
        userEmail: user.email,
        userName: user.name,
        userId: user.userId,
        contentLength: newsletterResult.content?.length,
        version: 'V1',
        createdAt: article.createdAt,
      });
    } catch (slackError) {
      this.logger.warn(
        'Failed to send Slack notification for article generation:',
        slackError,
      );
    }

    return {
      id: article.articleId,
      title: newsletterResult.title,
      content: newsletterResult.content,
      createdAt: article.createdAt,
      userId: user.userId,
    } as GenerateArticleResponse;
  }

  // Event tracking moved to client

  /**
   * WritingStyle 검증 및 조회 (선택사항)
   * @private
   */
  private async validateAndGetWritingStyle(
    writingStyleId: number | undefined,
    userId: string,
  ): Promise<WritingStyle | undefined> {
    if (!writingStyleId) {
      return undefined;
    }

    const writingStyle = await this.writingStyleRepository.findOne({
      id: writingStyleId,
      user: { userId: userId },
    });

    if (!writingStyle) {
      throw new NotFoundException('문체 스타일을 찾을 수 없습니다.');
    }

    return writingStyle;
  }

  /**
   * 모든 아티클 조회
   */
  async findAll(): Promise<Article[]> {
    return this.articleRepository.findAll({
      populate: ['user'],
      orderBy: { createdAt: 'DESC' },
      filters: { isDeleted: false },
    });
  }

  /**
   * Resolve article identifier (UUID or legacy numeric ID) to canonical UUID
   * @param identifier Article UUID or legacy numeric ID
   * @param options Configuration options
   * @returns Canonical UUID string or null if not found
   */
  async resolveCanonicalArticleId(
    identifier: ArticleIdentifierLike,
    { throwOnNotFound = true }: { throwOnNotFound?: boolean } = {},
  ): Promise<string | null> {
    const normalized = ensureArticleIdentifier(identifier);

    // If it's already a UUID, return it
    if (typeof normalized === 'string' && isUuid(normalized)) {
      return normalized.toLowerCase();
    }

    // Look up by legacy ID
    const article = await this.articleRepository.findOne(
      buildArticleFilterFromInput(normalized),
    );

    if (!article) {
      if (throwOnNotFound) {
        throw new NotFoundException('Article not found');
      }
      return null;
    }

    return article.articleId;
  }

  /**
   * 특정 아티클 조회
   */
  async findOne(articleId: string): Promise<any> {
    const article = await this.articleRepository.findOne(
      { articleId },
      {
        populate: ['user', 'archives', 'writingStyle', 'articleScraps.scrap'],
        filters: { isDeleted: false },
      },
    );

    if (!article) {
      throw new NotFoundException('아티클을 찾을 수 없습니다.');
    }

    // 모든 아카이브 버전을 버전 번호 순으로 정렬
    const sortedArchives = article.archives
      .getItems()
      .sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0));

    const latestArchive = article.getLatestArchive();

    // 아티클 생성에 사용된 스크랩 목록
    const scraps = article.articleScraps
      .getItems()
      .filter((as) => !as.scrap.isDeleted)
      .map((as) => ({
        scrapId: as.scrap.scrapId,
        title: as.scrap.title,
        url: as.scrap.url,
        content: as.scrap.content,
        userComment: as.userComment || as.scrap.userComment,
        createdAt: as.scrap.createdAt,
      }));

    return {
      articleId: article.articleId,
      title: article.getLatestTitle() || article.topic,
      content: article.getLatestContent() || '',
      contentFormat: latestArchive?.contentFormat || 'markdown',
      topic: article.topic,
      keyInsight: article.keyInsight,
      generationParams: article.generationParams,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      user: article.user,
      writingStyleId: article.writingStyle?.id,
      writingStyleName: article.writingStyle?.name,
      scraps,
      archives: sortedArchives.map((archive) => ({
        archiveId: archive.articleArchiveId,
        title: archive.title,
        content: archive.content,
        contentFormat: archive.contentFormat || 'markdown',
        versionNumber: archive.versionNumber,
        createdAt: archive.createdAt,
      })),
    };
  }

  /**
   * 사용자별 아티클 조회
   */
  async findByUser(
    userId: string,
    sortBy?: 'created_at' | 'updated_at',
    sortOrder?: 'ASC' | 'DESC',
  ): Promise<any[]> {
    const user = await this.getUserOrThrow(userId);

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    let orderBy: any = { createdAt: 'DESC' };
    switch (sortBy) {
      case 'created_at':
        orderBy = { createdAt: sortOrder };
        break;
      case 'updated_at':
        orderBy = { updatedAt: sortOrder };
    }

    const articles = await this.articleRepository.find(
      { user, isDeleted: false },
      {
        populate: ['user', 'archives'],
        orderBy: orderBy,
      },
    );

    // 각 아티클에 대해 최신 아카이브 정보를 포함한 응답 생성
    return articles.map((article) => ({
      articleId: article.articleId,
      title: article.getLatestTitle() || article.topic,
      content: article.getLatestContent()?.substring(0, 100) || '',
      topic: article.topic,
      keyInsight: article.keyInsight,
      generationParams: article.generationParams,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      user: article.user,
    }));
  }

  /**
   * 아티클 업데이트
   */
  async update(
    articleId: string,
    updateArticleDto: UpdateArticleDto,
  ): Promise<any> {
    const article = await this.articleRepository.findOne(
      { articleId, isDeleted: false },
      {
        populate: ['user', 'archives'],
      },
    );

    if (!article) {
      throw new NotFoundException('아티클을 찾을 수 없습니다.');
    }

    // title이나 content가 변경되면 새로운 아카이브 버전 생성
    if (updateArticleDto.title || updateArticleDto.content) {
      // 기존 최신 아카이브 찾기
      const latestArchive = await this.em.findOne(
        ArticleArchive,
        { article: article, isDeleted: false },
        { orderBy: { versionNumber: 'desc' }, filters: { isDeleted: false } },
      );

      const newTitle =
        updateArticleDto.title || latestArchive?.title || article.topic;
      const newContent =
        updateArticleDto.content || latestArchive?.content || '내용 없음';

      // 내용이 실제로 변경되었는지 확인
      const titleChanged = latestArchive?.title !== newTitle;
      const contentChanged = latestArchive?.content !== newContent;

      console.log('🔍 Version Check:', {
        latestArchiveTitle: latestArchive?.title,
        newTitle,
        titleChanged,
        latestArchiveContent: latestArchive?.content?.substring(0, 100) + '...',
        newContent: newContent.substring(0, 100) + '...',
        contentChanged,
      });

      if (titleChanged || contentChanged) {
        const newVersionNumber = (latestArchive?.versionNumber || 0) + 1;

        console.log('📝 Creating new archive version:', newVersionNumber);

        const newArchive = new ArticleArchive();
        newArchive.title = newTitle;
        newArchive.content = newContent;
        newArchive.contentFormat = updateArticleDto.contentFormat || 'markdown';
        newArchive.versionNumber = newVersionNumber;
        newArchive.article = article;

        await this.em.persistAndFlush(newArchive);

        console.log('✅ New archive created successfully');
      } else {
        console.log('⚠️ No changes detected, skipping version creation');
      }
    }

    if (updateArticleDto.topic) {
      article.topic = updateArticleDto.topic;
    }

    if (updateArticleDto.keyInsights) {
      article.keyInsight = updateArticleDto.keyInsights;
    }

    if (updateArticleDto.generationParams) {
      article.generationParams = updateArticleDto.generationParams;
    }

    await this.em.persistAndFlush(article);

    // 업데이트된 아티클 정보 반환
    return this.findOne(articleId);
  }

  /**
   * 아티클 삭제
   */
  async remove(articleId: string): Promise<void> {
    const article = await this.articleRepository.findOne(
      { articleId, isDeleted: false },
      {
        populate: ['archives'],
      },
    );

    if (!article) {
      throw new NotFoundException('아티클을 찾을 수 없습니다.');
    }

    if (article.archives.length > 0) {
      for (const archive of article.archives) {
        archive.isDeleted = true;
        this.em.persistAndFlush(archive);
      }
    }

    article.isDeleted = true;
    await this.em.persistAndFlush(article);
  }

  /**
   * 아티클 아카이브
   */
  async archive(articleId: string): Promise<ArticleArchive> {
    const article = await this.findOne(articleId);

    // 최신 아카이브에서 title과 content 가져오기
    const latestArchive = await this.em.findOne(
      ArticleArchive,
      { article: article, isDeleted: false },
      { orderBy: { versionNumber: 'desc' }, filters: { isDeleted: false } },
    );

    const archive = new ArticleArchive();
    archive.title = latestArchive?.title || article.topic;
    archive.content = latestArchive?.content || '내용 없음';
    archive.versionNumber = (latestArchive?.versionNumber || 0) + 1;
    archive.article = article;

    await this.em.persistAndFlush(archive);

    return archive;
  }

  /**
   * 아티클 버전 히스토리 조회
   */
  async getVersions(articleId: string, userId: string): Promise<any[]> {
    this.logger.log(
      `📋 Fetching versions for article ${articleId} by user ${userId}`,
    );

    const article = await this.articleRepository.findOne(
      { articleId, isDeleted: false },
      { populate: ['archives', 'user'] },
    );

    if (!article) {
      throw new NotFoundException('아티클을 찾을 수 없습니다.');
    }

    // 권한 검증
    if (article.user.userId !== userId) {
      throw new ForbiddenException('이 아티클에 접근할 권한이 없습니다.');
    }

    // 모든 아카이브 버전을 버전 번호 역순으로 정렬 (최신 버전이 먼저)
    const versions = article.archives
      .getItems()
      .filter((archive) => !archive.isDeleted)
      .sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0))
      .map((archive) => ({
        versionNumber: archive.versionNumber,
        title: archive.title,
        content: archive.content,
        contentFormat: archive.contentFormat || 'markdown',
        createdAt: archive.createdAt,
        characterCount: archive.content?.length || 0,
      }));

    this.logger.log(
      `✅ Retrieved ${versions.length} versions for article ${articleId}`,
    );

    return versions;
  }

  /**
   * 특정 버전으로 복원
   */
  async restoreVersion(
    articleId: string,
    versionNumber: number,
    userId: string,
  ): Promise<any> {
    this.logger.log(
      `🔄 Restoring article ${articleId} to version ${versionNumber} by user ${userId}`,
    );

    // 입력 검증
    if (versionNumber < 1) {
      throw new BadRequestException('버전 번호는 1 이상이어야 합니다.');
    }

    // 트랜잭션 및 락을 사용하여 동시성 문제 방지
    return await this.em.transactional(async (em) => {
      // Article만 PESSIMISTIC_WRITE 락으로 조회 (populate 없이)
      const article = await em.findOne(
        Article,
        { articleId, isDeleted: false },
        {
          lockMode: LockMode.PESSIMISTIC_WRITE,
        },
      );

      if (!article) {
        throw new NotFoundException('아티클을 찾을 수 없습니다.');
      }

      // 권한 검증을 위해 user 별도 조회
      await em.populate(article, ['user']);

      if (article.user.userId !== userId) {
        throw new ForbiddenException('이 아티클을 수정할 권한이 없습니다.');
      }

      // archives 별도 조회
      await em.populate(article, ['archives']);

      // 복원할 버전 찾기
      const targetVersion = article.archives
        .getItems()
        .find(
          (archive) =>
            archive.versionNumber === versionNumber && !archive.isDeleted,
        );

      if (!targetVersion) {
        throw new NotFoundException(
          `버전 ${versionNumber}을(를) 찾을 수 없습니다.`,
        );
      }

      // 이미 로드된 archives에서 최신 버전 번호 계산 (중복 쿼리 제거)
      const latestVersionNumber = Math.max(
        ...article.archives
          .getItems()
          .filter((a) => !a.isDeleted)
          .map((a) => a.versionNumber || 0),
        0,
      );

      // 최신 버전 복원 시도 검증
      if (versionNumber === latestVersionNumber) {
        throw new BadRequestException('이미 최신 버전입니다.');
      }

      // 새 버전 생성 (복원된 내용으로)
      const newVersionNumber = latestVersionNumber + 1;
      const newArchive = new ArticleArchive();
      newArchive.title = targetVersion.title;
      newArchive.content = targetVersion.content;
      newArchive.contentFormat = targetVersion.contentFormat || 'markdown';
      newArchive.versionNumber = newVersionNumber;
      newArchive.article = article;

      await em.persistAndFlush(newArchive);

      this.logger.log(
        `✅ Version ${versionNumber} restored as new version ${newVersionNumber}`,
      );

      // 복원된 아티클 정보 반환
      return this.findOne(articleId);
    });
  }

  /**
   * 아티클 검색
   */
  async search(query: string, userId?: string): Promise<Article[]> {
    const whereClause: any = {
      $or: [
        { topic: { $like: `%${query}%` } },
        { keyInsight: { $like: `%${query}%` } },
      ],
    };

    if (userId) {
      whereClause.user = { userId };
    }

    return this.articleRepository.find(whereClause, {
      populate: ['user'],
      orderBy: { createdAt: 'DESC' },
      filters: { isDeleted: false },
    });
  }

  /**
   * 배치 아티클 삭제
   */
  async removeBatch(articleIds: string[]): Promise<void> {
    const articles = await this.articleRepository.find({
      articleId: { $in: articleIds },
      isDeleted: false,
    });

    if (articles.length !== articleIds.length) {
      throw new NotFoundException('일부 아티클을 찾을 수 없습니다.');
    }

    for (const article of articles) {
      article.isDeleted = true;
      await this.em.persistAndFlush(article);
    }
  }

  /**
   * V2 API: 비동기 아티클 생성 - 즉시 202 응답 후 백그라운드 처리
   */
  async generateArticleV2(
    userId: string,
    generateDto: GenerateArticleV2Dto,
  ): Promise<GenerateArticleV2Response> {
    this.logger.log(
      `🚀 Starting V2 async article generation for user ${userId}`,
    );

    // 사용자 검증
    const user = await this.getUserOrThrow(userId);
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    // 즉시 processing 상태로 아티클 생성
    const article = new Article();
    article.topic = generateDto.topic;
    article.keyInsight = generateDto.keyInsight;
    article.generationParams = generateDto.generationParams;
    article.generationStatus = 'processing';
    article.user = user;
    article.writingStyle = await this.validateAndGetWritingStyle(
      generateDto.writingStyleId,
      userId,
    );

    await this.em.persistAndFlush(article);

    // 백그라운드에서 실제 생성 작업 실행
    setImmediate(async () => {
      await this.performBackgroundGeneration(article.articleId, generateDto);
    });

    this.logger.log(
      `✅ V2 article generation queued: articleId=${article.articleId}`,
    );

    return {
      articleId: article.articleId,
      status: 'processing',
      message: '아티클 생성이 시작되었습니다. 잠시 후 결과를 확인해주세요.',
      createdAt: article.createdAt,
    };
  }

  /**
   * V2 API: 아티클 상태 확인
   */
  async getArticleStatusV2(
    articleId: string,
  ): Promise<ArticleStatusV2Response> {
    const article = await this.articleRepository.findOne(
      { articleId, isDeleted: false },
      { populate: ['user', 'archives'] },
    );

    if (!article) {
      throw new NotFoundException('아티클을 찾을 수 없습니다.');
    }

    const latestArchive = article.getLatestArchive();

    return {
      articleId: article.articleId,
      status: article.generationStatus,
      title: latestArchive?.title,
      content: latestArchive?.content,
      createdAt: article.createdAt,
    };
  }

  /**
   * V2 API: 사용자별 아티클 조회 (상태 정보 포함)
   */
  async findByUserV2(userId: string): Promise<any[]> {
    const user = await this.getUserOrThrow(userId);

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const articles = await this.articleRepository.find(
      { user, isDeleted: false },
      {
        populate: ['user', 'archives'],
        orderBy: { createdAt: 'DESC' },
      },
    );

    // 각 아티클에 대해 상태 정보를 포함한 응답 생성
    return articles.map((article) => ({
      articleId: article.articleId,
      title: article.getLatestTitle() || article.topic,
      content: article.getLatestContent()?.substring(0, 100) || '',
      topic: article.topic,
      keyInsight: article.keyInsight,
      generationParams: article.generationParams,
      generationStatus: article.generationStatus,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      user: article.user,
    }));
  }

  /**
   * 백그라운드에서 실제 아티클 생성 수행
   */
  private async performBackgroundGeneration(
    articleId: string,
    generateDto: GenerateArticleV2Dto,
  ): Promise<void> {
    try {
      this.logger.log(
        `🔄 Background generation started for articleId=${articleId}`,
      );

      // 아티클 다시 조회
      const article = await this.articleRepository.findOne(
        { articleId },
        { populate: ['user'] },
      );

      if (!article) {
        this.logger.error(
          `❌ Article not found during background generation: ${articleId}`,
        );
        return;
      }

      // 스크랩 데이터 준비 (기존 로직과 동일)
      let scrapsWithComments: Array<{ scrap: Scrap; userComment?: string }> =
        [];

      if (
        generateDto.scrapWithOptionalComment &&
        generateDto.scrapWithOptionalComment.length > 0
      ) {
        const scraps = await this.scrapRepository.find({
          scrapId: {
            $in: generateDto.scrapWithOptionalComment.map(
              (comment) => comment.scrapId,
            ),
          },
          user: article.user,
          isDeleted: false,
        });

        scrapsWithComments = scraps.map((scrap) => {
          const scrapComment = generateDto.scrapWithOptionalComment?.find(
            (comment) => comment.scrapId === scrap.scrapId,
          );
          return {
            scrap,
            userComment: scrapComment?.userComment,
          };
        });
      }

      // 문체 예시 준비
      let writingStyleExampleContents: string[] = [];
      if (generateDto.writingStyleId) {
        const writingStyleExamples =
          await this.writingStyleExampleRepository.find(
            {
              writingStyle: {
                id: generateDto.writingStyleId,
                user: article.user,
              },
            },
            { populate: ['writingStyle'] },
          );
        writingStyleExampleContents = writingStyleExamples.map(
          (example) => example.content,
        );
      }

      // Convert scrapsWithComments to the format expected by FastAPI
      const formattedScrapsWithComments = scrapsWithComments.map((item) => ({
        scrap: {
          id: item.scrap.scrapId,
          title: item.scrap.title,
          url: item.scrap.url,
          content: item.scrap.content,
          userComment: item.scrap.userComment,
        },
        userComment: item.userComment,
      }));

      // AI 뉴스레터 생성
      const newsletterResult =
        await this.newsletterAgentService.generateNewsletter({
          topic: generateDto.topic,
          keyInsight: generateDto.keyInsight,
          scrapsWithComments: formattedScrapsWithComments,
          generationParams: generateDto.generationParams,
          articleStructureTemplate: generateDto.articleStructureTemplate,
          writingStyleExampleContents,
        });

      // AI 생성 결과를 아카이브에 저장
      const archive = new ArticleArchive();
      archive.title = newsletterResult.title;
      archive.content = newsletterResult.content;
      archive.versionNumber = 1;
      archive.article = article;

      // 아티클-스크랩 관계 저장 (정션 테이블)
      const articleScraps: ArticleScrap[] = [];
      for (const item of scrapsWithComments) {
        const articleScrap = new ArticleScrap();
        articleScrap.article = article;
        articleScrap.scrap = item.scrap;
        articleScrap.userComment = item.userComment;
        articleScraps.push(articleScrap);
      }

      // 아티클 상태 업데이트
      article.generationStatus = 'completed';

      await this.em.persistAndFlush([archive, article, ...articleScraps]);

      this.logger.log(
        `🎉 Background generation completed for articleId=${articleId}`,
      );

      // Send Slack notification for successful article generation
      try {
        await this.slackService.notifyArticleGeneration({
          articleId: article.articleId,
          title: newsletterResult.title,
          topic: generateDto.topic,
          keyInsight: generateDto.keyInsight,
          userEmail: article.user.email,
          userName: article.user.name,
          userId: article.user.userId,
          contentLength: newsletterResult.content?.length,
          version: 'V2',
          createdAt: article.createdAt,
        });
      } catch (slackError) {
        this.logger.warn(
          'Failed to send Slack notification for V2 article generation:',
          slackError,
        );
      }

      // Event tracking moved to client
    } catch (error) {
      this.logger.error(
        `❌ Background generation failed for articleId=${articleId}:`,
        error,
      );

      try {
        // 실패 상태로 업데이트
        const article = await this.articleRepository.findOne({ articleId });
        if (article) {
          article.generationStatus = 'failed';
          await this.em.persistAndFlush(article);
        }
      } catch (updateError) {
        this.logger.error(
          `❌ Failed to update error status for articleId=${articleId}:`,
          updateError,
        );
      }
    }
  }

  // ========== V3 API Methods (PDF 지원) ==========

  /**
   * V3 API: 비동기 아티클 생성 - PDF 업로드 지원
   */
  async generateArticleV3(
    userId: string,
    generateDto: GenerateArticleV3Dto,
  ): Promise<GenerateArticleV2Response> {
    this.logger.log(
      `🚀 Starting V3 async article generation for user ${userId}`,
    );

    // 사용자 검증
    const user = await this.getUserOrThrow(userId);
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    // 즉시 processing 상태로 아티클 생성
    const article = new Article();
    article.topic = generateDto.topic;
    article.keyInsight = generateDto.keyInsight;
    article.generationParams = generateDto.generationParams;
    article.generationStatus = 'processing';
    article.user = user;
    article.writingStyle = await this.validateAndGetWritingStyle(
      generateDto.writingStyleId,
      userId,
    );

    await this.em.persistAndFlush(article);

    // 백그라운드에서 실제 생성 작업 실행
    setImmediate(async () => {
      await this.performBackgroundGenerationV3(article.articleId, generateDto);
    });

    this.logger.log(
      `✅ V3 article generation queued: articleId=${article.articleId}`,
    );

    return {
      articleId: article.articleId,
      status: 'processing',
      message: '뉴스레터 생성이 시작되었습니다.',
      createdAt: article.createdAt,
    };
  }

  /**
   * V2 API: 아티클 상태 확인 (PDF 진행률 포함)
   */
  async getArticleStatusV3(
    articleId: string,
  ): Promise<ArticleStatusV2Response> {
    const article = await this.articleRepository.findOne(
      { articleId, isDeleted: false },
      { populate: ['user', 'archives'] },
    );

    if (!article) {
      throw new NotFoundException('아티클을 찾을 수 없습니다.');
    }

    const latestArchive = article.getLatestArchive();

    const response: ArticleStatusV2Response = {
      articleId: article.articleId,
      status: article.generationStatus,
      title: latestArchive?.title,
      content: latestArchive?.content,
      createdAt: article.createdAt,
    };

    return response;
  }

  /**
   * V2 API: 사용자별 아티클 조회 (PDF 정보 포함)
   */
  async findByUserV3(userId: string): Promise<any[]> {
    const user = await this.getUserOrThrow(userId);

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const articles = await this.articleRepository.find(
      { user, isDeleted: false },
      {
        populate: ['user', 'archives'],
        orderBy: { createdAt: 'DESC' },
      },
    );

    // 각 아티클에 대해 PDF 정보를 포함한 응답 생성
    return articles.map((article) => ({
      articleId: article.articleId,
      title: article.getLatestTitle() || article.topic,
      content: article.getLatestContent()?.substring(0, 100) || '',
      topic: article.topic,
      keyInsight: article.keyInsight,
      generationParams: article.generationParams,
      generationStatus: article.generationStatus,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      user: article.user,
      // V3에서는 PDF 참고 자료 정보도 포함할 수 있음 (추후 구현)
      pdfReferences: [], // 임시로 빈 배열
    }));
  }

  /**
   * V3 백그라운드에서 실제 아티클 생성 수행 (PDF 지원)
   */
  private async performBackgroundGenerationV3(
    articleId: string,
    generateDto: GenerateArticleV3Dto,
  ): Promise<void> {
    try {
      this.logger.log(
        `🔄 V3 Background generation started for articleId=${articleId}`,
      );

      // 아티클 다시 조회
      const article = await this.articleRepository.findOne(
        { articleId },
        { populate: ['user'] },
      );

      if (!article) {
        this.logger.error(
          `❌ Article not found during background generation: ${articleId}`,
        );
        return;
      }

      // 스크랩 데이터 준비 (V2와 동일)
      let scrapsWithComments: Array<{ scrap: Scrap; userComment?: string }> =
        [];

      if (
        generateDto.scrapWithOptionalComment &&
        generateDto.scrapWithOptionalComment.length > 0
      ) {
        const scraps = await this.scrapRepository.find({
          scrapId: {
            $in: generateDto.scrapWithOptionalComment.map(
              (comment) => comment.scrapId,
            ),
          },
          user: article.user,
          isDeleted: false,
        });

        scrapsWithComments = scraps.map((scrap) => {
          const scrapComment = generateDto.scrapWithOptionalComment?.find(
            (comment) => comment.scrapId === scrap.scrapId,
          );
          return {
            scrap,
            userComment: scrapComment?.userComment,
          };
        });
      }

      // PDF 업로드 데이터 준비
      let pdfUploadsWithPrompts: Array<{
        url: string;
        usagePrompt: string;
        aiContent: string;
      }> = [];

      // PDF 스크랩과 사용 프롬프트 매핑 (ArticleScrap 생성용)
      let uploadScraps: Scrap[] = [];
      const usagePromptById = new Map<string, string>();

      if (
        generateDto.uploadWithUsagePrompt &&
        generateDto.uploadWithUsagePrompt.length > 0
      ) {
        // Treat uploads as scraps with file metadata; uploadedFileId corresponds to scrapId
        const uploads = generateDto.uploadWithUsagePrompt;
        const scrapIds = uploads.map((u) => u.uploadedFileId);

        // Build usagePrompt lookup for O(1)
        for (const u of uploads)
          usagePromptById.set(u.uploadedFileId, u.usagePrompt);

        // Fetch only non-deleted scraps for the user
        uploadScraps = await this.scrapRepository.find({
          ...this.buildScrapIdFilter(scrapIds),
          user: article.user,
          isDeleted: false,
        });

        // Map to payload; skip entries without a resolvable URL
        pdfUploadsWithPrompts = uploadScraps
          .map((scrap) => {
            const url = scrap.filePath || scrap.url;
            if (!url) return null;
            return {
              url,
              usagePrompt: usagePromptById.get(scrap.scrapId) || '',
              aiContent: scrap.aiContent || '',
            };
          })
          .filter(
            (x): x is { url: string; usagePrompt: string; aiContent: string } =>
              x !== null,
          );
      }

      // 문체 예시 준비
      let writingStyleExampleContents: string[] = [];
      if (generateDto.writingStyleId) {
        const writingStyleExamples =
          await this.writingStyleExampleRepository.find(
            {
              writingStyle: {
                id: generateDto.writingStyleId,
                user: article.user,
              },
            },
            { populate: ['writingStyle'] },
          );
        writingStyleExampleContents = writingStyleExamples.map(
          (example) => example.content,
        );
      }

      // Convert scrapsWithComments to the format expected by FastAPI
      const formattedScrapsWithComments = scrapsWithComments.map((item) => ({
        scrap: {
          id: item.scrap.scrapId,
          title: item.scrap.title,
          url: item.scrap.url,
          content: item.scrap.content,
          userComment: item.scrap.userComment,
        },
        userComment: item.userComment,
      }));

      // V3: AI 뉴스레터 생성 (PDF 정보 포함)
      const newsletterResult =
        await this.newsletterAgentService.generateNewsletter({
          topic: generateDto.topic,
          keyInsight: generateDto.keyInsight,
          scrapsWithComments: formattedScrapsWithComments,
          generationParams: generateDto.generationParams,
          articleStructureTemplate: generateDto.articleStructureTemplate,
          writingStyleExampleContents,
          // V3에서 추가: PDF 업로드 정보
          pdfUrlsWithPrompts: pdfUploadsWithPrompts, // 이 부분은 newsletterAgentService에서 지원해야 함
        });

      // AI 생성 결과를 아카이브에 저장
      const archive = new ArticleArchive();
      archive.title = newsletterResult.title;
      archive.content = newsletterResult.content;
      archive.versionNumber = 1;
      archive.article = article;

      // 아티클-스크랩 관계 저장 (정션 테이블)
      const articleScraps: ArticleScrap[] = [];

      // 웹 스크랩 관계 추가
      for (const item of scrapsWithComments) {
        const articleScrap = new ArticleScrap();
        articleScrap.article = article;
        articleScrap.scrap = item.scrap;
        articleScrap.userComment = item.userComment;
        articleScraps.push(articleScrap);
      }

      // PDF 스크랩 관계 추가
      if (uploadScraps && uploadScraps.length > 0) {
        for (const scrap of uploadScraps) {
          const articleScrap = new ArticleScrap();
          articleScrap.article = article;
          articleScrap.scrap = scrap;
          articleScrap.userComment = usagePromptById.get(scrap.scrapId);
          articleScraps.push(articleScrap);
        }
      }

      // 아티클 상태 업데이트
      article.generationStatus = 'completed';

      await this.em.persistAndFlush([archive, article, ...articleScraps]);

      this.logger.log(
        `🎉 V3 Background generation completed for articleId=${articleId}`,
      );

      // Send Slack notification for successful article generation
      try {
        await this.slackService.notifyArticleGeneration({
          articleId: article.articleId,
          title: newsletterResult.title,
          topic: generateDto.topic,
          keyInsight: generateDto.keyInsight,
          userEmail: article.user.email,
          userName: article.user.name,
          userId: article.user.userId,
          contentLength: newsletterResult.content?.length,
          version: 'V3',
          createdAt: article.createdAt,
        });
      } catch (slackError) {
        this.logger.warn(
          'Failed to send Slack notification for V3 article generation:',
          slackError,
        );
      }

      // Event tracking moved to client
    } catch (error) {
      this.logger.error(
        `❌ V3 Background generation failed for articleId=${articleId}:`,
        error,
      );

      try {
        // 실패 상태로 업데이트
        const article = await this.articleRepository.findOne({ articleId });
        if (article) {
          article.generationStatus = 'failed';
          await this.em.persistAndFlush(article);
        }
      } catch (updateError) {
        this.logger.error(
          `❌ Failed to update error status for articleId=${articleId}:`,
          updateError,
        );
      }
    }
  }

  // ========== V3 Streaming API ==========

  /**
   * V3: 실시간 스트리밍으로 아티클 생성
   */
  generateArticleV3Stream(
    userId: string,
    generateDto: GenerateArticleV3Dto,
  ): Observable<MessageEvent> {
    return new Observable((observer) => {
      (async () => {
        let article: Article | null = null;
        let saved = false;

        try {
          this.logger.log(
            `📡 Starting V3 streaming article generation for user ${userId}`,
          );

          const user = await this.getUserOrThrow(userId);
          if (!user) {
            throw new NotFoundException('사용자를 찾을 수 없습니다.');
          }

          article = new Article();
          article.topic = generateDto.topic;
          article.keyInsight = generateDto.keyInsight;
          article.generationParams = generateDto.generationParams;
          article.generationStatus = 'processing';
          article.user = user;
          article.writingStyle = await this.validateAndGetWritingStyle(
            generateDto.writingStyleId,
            userId,
          );

          await this.em.persistAndFlush(article);

          let scrapsWithComments: Array<{
            scrap: Scrap;
            userComment?: string;
          }> = [];

          if (
            generateDto.scrapWithOptionalComment &&
            generateDto.scrapWithOptionalComment.length > 0
          ) {
            const scraps = await this.scrapRepository.find({
              scrapId: {
                $in: generateDto.scrapWithOptionalComment.map(
                  (comment) => comment.scrapId,
                ),
              },
              user,
              isDeleted: false,
            });

            scrapsWithComments = scraps.map((scrap) => {
              const scrapComment = generateDto.scrapWithOptionalComment?.find(
                (comment) => comment.scrapId === scrap.scrapId,
              );
              return {
                scrap,
                userComment: scrapComment?.userComment,
              };
            });
          }

          let pdfUploadsWithPrompts: Array<{
            url: string;
            usagePrompt: string;
            aiContent: string;
          }> = [];

          // PDF 스크랩과 사용 프롬프트 매핑 (ArticleScrap 생성용)
          let uploadScraps: Scrap[] = [];
          const usagePromptById = new Map<string, string>();

          if (
            generateDto.uploadWithUsagePrompt &&
            generateDto.uploadWithUsagePrompt.length > 0
          ) {
            const uploads = generateDto.uploadWithUsagePrompt;
            const scrapIds = uploads.map((u) => u.uploadedFileId);

            uploads.forEach((u) =>
              usagePromptById.set(u.uploadedFileId, u.usagePrompt),
            );

            uploadScraps = await this.scrapRepository.find({
              ...this.buildScrapIdFilter(scrapIds),
              user,
              isDeleted: false,
            });

            pdfUploadsWithPrompts = uploadScraps
              .map((scrap) => {
                const url = scrap.filePath || scrap.url;
                if (!url) return null;
                return {
                  url,
                  usagePrompt: usagePromptById.get(scrap.scrapId) || '',
                  aiContent: scrap.aiContent || '',
                };
              })
              .filter(
                (
                  item,
                ): item is { url: string; usagePrompt: string; aiContent: string } =>
                  item !== null,
              );
          }

          let writingStyleExampleContents: string[] = [];
          if (generateDto.writingStyleId) {
            const examples = await this.writingStyleExampleRepository.find(
              {
                writingStyle: {
                  id: generateDto.writingStyleId,
                  user,
                },
              },
              { populate: ['writingStyle'] },
            );
            writingStyleExampleContents = examples.map(
              (example) => example.content,
            );
          }

          const formattedScrapsWithComments = scrapsWithComments.map(
            (item) => ({
              scrap: {
                id: item.scrap.scrapId,
                title: item.scrap.title,
                url: item.scrap.url,
                content: item.scrap.content,
                userComment: item.scrap.userComment,
              },
              userComment: item.userComment,
            }),
          );

          const newsletterInput = {
            topic: generateDto.topic,
            keyInsight: generateDto.keyInsight,
            scrapsWithComments: formattedScrapsWithComments,
            generationParams: generateDto.generationParams,
            articleStructureTemplate: generateDto.articleStructureTemplate,
            writingStyleExampleContents,
            pdfUrlsWithPrompts: pdfUploadsWithPrompts,
          };

          const stream = this.newsletterAgentService.generateNewsletterStream(
            newsletterInput,
          );

          for await (const event of stream) {
            if (event.type === EventType.COMPLETE && article && !saved) {
              // Don't send the COMPLETE event yet - we'll send it after saving with articleId
              saved = true;
              const archive = new ArticleArchive();
              archive.title = event.title;
              archive.content = event.content;
              archive.versionNumber = 1;
              archive.article = article;

              const articleScraps: ArticleScrap[] = [];

              // 웹 스크랩 관계 추가
              scrapsWithComments.forEach((item) => {
                const articleScrap = new ArticleScrap();
                articleScrap.article = article as Article;
                articleScrap.scrap = item.scrap;
                articleScrap.userComment = item.userComment;
                articleScraps.push(articleScrap);
              });

              // PDF 스크랩 관계 추가
              if (uploadScraps && uploadScraps.length > 0) {
                uploadScraps.forEach((scrap) => {
                  const articleScrap = new ArticleScrap();
                  articleScrap.article = article as Article;
                  articleScrap.scrap = scrap;
                  articleScrap.userComment = usagePromptById.get(scrap.scrapId);
                  articleScraps.push(articleScrap);
                });
              }

              article.generationStatus = 'completed';
              await this.em.persistAndFlush([archive, article, ...articleScraps]);

              try {
                await this.slackService.notifyArticleGeneration({
                  articleId: article.articleId,
                  title: event.title,
                  topic: generateDto.topic,
                  keyInsight: generateDto.keyInsight,
                  userEmail: user.email,
                  userName: user.name,
                  userId: user.userId,
                  contentLength: event.content.length,
                  version: 'V3-Stream',
                  createdAt: article.createdAt,
                });
              } catch (slackError) {
                this.logger.warn(
                  'Failed to send Slack notification:',
                  slackError,
                );
              }

              observer.next({
                data: {
                  type: EventType.PROGRESS,
                  timestamp: Date.now(),
                  node: 'database',
                  message_ko: '생성된 콘텐츠를 저장했습니다.',
                  message_en: 'Saved generated content.',
                  progress: 100,
                  metadata: { articleId: article.articleId },
                },
              } as MessageEvent);

              // Now send the COMPLETE event with articleId
              observer.next({
                data: {
                  ...event,
                  metadata: { articleId: article.articleId },
                },
              } as MessageEvent);
            } else {
              // For non-COMPLETE events, just forward them
              observer.next({ data: event } as MessageEvent);
            }

            if (event.type === EventType.ERROR && article) {
              article.generationStatus = 'failed';
              await this.em.persistAndFlush(article);
            }
          }

          if (!saved && article) {
            article.generationStatus = 'failed';
            await this.em.persistAndFlush(article);
          }

          observer.complete();
        } catch (error) {
          this.logger.error('❌ Streaming article generation failed:', error);

          if (article) {
            try {
              article.generationStatus = 'failed';
              await this.em.persistAndFlush(article);
            } catch (updateError) {
              this.logger.error(
                'Failed to update article status:',
                updateError,
              );
            }
          }

          observer.next({
            data: {
              type: EventType.ERROR,
              timestamp: Date.now(),
              message: (error as Error)?.message || 'Streaming failed',
              error_type: (error as Error)?.name ?? 'Error',
            },
          } as MessageEvent);

          observer.error(error);
        }
      })();
    });
  }

  // ========== Article Regeneration API ==========

  /**
   * V3: 기존 아티클 재생성 (동기)
   */
  async regenerateArticleV3(
    articleId: string,
    userId: string,
    dto: RegenerateArticleV3Dto,
  ): Promise<any> {
    this.logger.log(
      `🔄 Starting article regeneration for articleId=${articleId}, userId=${userId}`,
    );

    const startTime = Date.now();

    return await this.em.transactional(async (trx) => {
      // Step 1: Fetch and validate article ownership
      const article = await trx.findOne(
        Article,
        { articleId, user: { userId } as any },
        {
          populate: [
            'user',
            'writingStyle',
            'articleScraps.scrap',
            'archives',
          ],
        },
      );

      if (!article) {
        throw new NotFoundException(
          `Article with ID ${articleId} not found`,
        );
      }

      // Step 2: Validate scraps if provided
      let addedScraps: Scrap[] = [];
      if (dto.addedScrapIds && dto.addedScrapIds.length > 0) {
        addedScraps = await trx.find(Scrap, {
          ...this.buildScrapIdFilter(dto.addedScrapIds),
          user: { userId } as any,
          isDeleted: false,
        });

        if (addedScraps.length !== dto.addedScrapIds.length) {
          const foundIds = addedScraps.map((s) => s.scrapId);
          const missingIds = dto.addedScrapIds.filter((id) => !foundIds.includes(id));
          throw new BadRequestException(
            `Scrap IDs not found or not accessible: [${missingIds.join(', ')}]`,
          );
        }
      }

      let removedScrapsData: Array<{
        id: string;
        title: string;
        url: string;
        content: string;
        userComment: string;
      }> = [];

      // Validate scraps to be removed
      if (dto.removedScrapIds && dto.removedScrapIds.length > 0) {
        const existingArticleScraps = await trx.find(
          ArticleScrap,
          {
            article: { articleId: article.articleId },
            scrap: this.buildScrapIdFilter(dto.removedScrapIds) as any,
          },
          { populate: ['scrap'] },
        );

        if (existingArticleScraps.length !== dto.removedScrapIds.length) {
          const foundIds = existingArticleScraps.map((as) => as.scrap.scrapId);
          const missingIds = dto.removedScrapIds.filter((id) => !foundIds.includes(id));
          throw new BadRequestException(
            `Scrap IDs not associated with this article: [${missingIds.join(', ')}]`,
          );
        }

        removedScrapsData = existingArticleScraps.map((as) => ({
          id: as.scrap.scrapId,
          title: as.scrap.title,
          url: as.scrap.url,
          content: as.scrap.content,
          userComment: as.userComment || as.scrap.userComment || '',
        }));
      }

      // Step 3: Validate writing style if provided
      let writingStyle: WritingStyle | null | undefined = undefined;
      if (dto.writingStyleId !== undefined) {
        if (dto.writingStyleId === null) {
          writingStyle = null; // Explicit removal
        } else {
          writingStyle = await trx.findOne(WritingStyle, {
            id: dto.writingStyleId,
            user: { userId } as any,
          });

          if (!writingStyle) {
            throw new BadRequestException(
              `Writing style with ID ${dto.writingStyleId} not found or not accessible`,
            );
          }
        }
      }

      // Step 4: Update article metadata
      if (dto.topic !== undefined) {
        article.topic = dto.topic;
      }
      if (dto.keyInsight !== undefined) {
        article.keyInsight = dto.keyInsight;
      }
      if (dto.generationParams !== undefined) {
        article.generationParams = dto.generationParams;
      }
      if (writingStyle !== undefined) {
        article.writingStyle = writingStyle === null ? undefined : writingStyle;
      }

      // Step 4.5: Prepare PDF uploads (before Step 5 so uploadScraps is available)
      let pdfUploadsWithPrompts: Array<{
        url: string;
        usagePrompt: string;
        aiContent: string;
      }> = [];

      // PDF 스크랩과 사용 프롬프트 매핑 (ArticleScrap 동기화용)
      let uploadScraps: Scrap[] = [];
      const usagePromptByIdForPdf = new Map<string, string>();

      if (dto.uploadWithUsagePrompt && dto.uploadWithUsagePrompt.length > 0) {
        const uploads = dto.uploadWithUsagePrompt;
        const scrapIds = uploads.map((u) => u.uploadedFileId);

        uploads.forEach((u) =>
          usagePromptByIdForPdf.set(u.uploadedFileId, u.usagePrompt ?? ''),
        );

        uploadScraps = await this.scrapRepository.find({
          ...this.buildScrapIdFilter(scrapIds),
          user: { userId } as any,
          isDeleted: false,
        });

        pdfUploadsWithPrompts = uploadScraps
          .map((scrap) => {
            const url = scrap.filePath || scrap.url;
            if (!url) return null;
            return {
              url,
              usagePrompt: usagePromptByIdForPdf.get(scrap.scrapId) || '',
              aiContent: scrap.aiContent || '',
            };
          })
          .filter(
            (
              item,
            ): item is { url: string; usagePrompt: string; aiContent: string } =>
              item !== null,
          );
      }

      // Step 5: Synchronize ArticleScrap associations (incremental)
      // Remove specified scraps
      if (dto.removedScrapIds && dto.removedScrapIds.length > 0) {
        // With orphanRemoval: true, just remove from collection
        // MikroORM will handle database deletion automatically on flush
        const itemsToRemove = article.articleScraps
          .getItems()
          .filter((as) => dto.removedScrapIds!.includes(as.scrap.scrapId));
        itemsToRemove.forEach((as) => article.articleScraps.remove(as));
      }

      // Add new web scraps
      if (dto.addedScrapIds && dto.addedScrapIds.length > 0) {
        const newArticleScraps = addedScraps.map((scrap) => {
          const articleScrap = new ArticleScrap();
          articleScrap.article = article;
          articleScrap.scrap = scrap;
          articleScrap.userComment = scrap.userComment; // Use scrap's default comment
          return articleScrap;
        });

        // Add new items to the collection
        newArticleScraps.forEach((as) => article.articleScraps.add(as));
      }

      // Add PDF scraps (새로 추가된 PDF)
      if (uploadScraps && uploadScraps.length > 0) {
        // 기존에 이미 연결된 PDF scrap ID들
        const existingScrapIds = new Set(
          article.articleScraps.getItems().map((as) => as.scrap.scrapId),
        );

        // 새로 추가할 PDF scraps (중복 제외)
        const newPdfScraps = uploadScraps.filter(
          (scrap) => !existingScrapIds.has(scrap.scrapId),
        );

        if (newPdfScraps.length > 0) {
          const newPdfArticleScraps = newPdfScraps.map((scrap) => {
            const articleScrap = new ArticleScrap();
            articleScrap.article = article;
            articleScrap.scrap = scrap;
            articleScrap.userComment = usagePromptByIdForPdf.get(scrap.scrapId);
            return articleScrap;
          });

          newPdfArticleScraps.forEach((as) => article.articleScraps.add(as));
        }
      }

      // Step 6: Calculate next version number
      const maxVersion = await trx.findOne(
        ArticleArchive,
        { article: { articleId: article.articleId } },
        { orderBy: { versionNumber: 'DESC' } },
      );
      const nextVersion = (maxVersion?.versionNumber || 0) + 1;

      // Step 7: Prepare scraps for AI generation
      // Use current article scraps (already updated with add/remove in Step 5)
      const currentArticleScraps = await trx.find(
        ArticleScrap,
        { article: { articleId: article.articleId } },
        { populate: ['scrap'] },
      );
      const scrapsWithComments = currentArticleScraps.map((as) => ({
        scrap: as.scrap,
        userComment: as.userComment,
      }));

      // Step 8: Prepare writing style examples
      let writingStyleExampleContents: string[] = [];
      const finalWritingStyle =
        writingStyle !== undefined ? writingStyle : article.writingStyle;

      if (finalWritingStyle) {
        const writingStyleExamples =
          await this.writingStyleExampleRepository.find(
            {
              writingStyle: { id: finalWritingStyle.id, user: { userId } as any },
            },
            { populate: ['writingStyle'] },
          );
        writingStyleExampleContents = writingStyleExamples.map(
          (example) => example.content,
        );
      }

      // Step 9: Get previous content and title
      const latestArchive = article.archives
        .getItems()
        .sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0))[0];

      if (!latestArchive) {
        throw new NotFoundException(
          'No previous version found for regeneration',
        );
      }

      const previousTitle = latestArchive.title || article.topic;
      const previousContent = latestArchive.content || '';

      // Step 10: Build user prompt from changes
      let userPromptParts: string[] = [];

      if (dto.topic && dto.topic !== article.topic) {
        userPromptParts.push(`주제를 "${dto.topic}"로 변경해주세요.`);
      }
      if (dto.keyInsight && dto.keyInsight !== article.keyInsight) {
        userPromptParts.push(`핵심 인사이트를 "${dto.keyInsight}"로 반영해주세요.`);
      }
      if (dto.addedScrapIds && dto.addedScrapIds.length > 0) {
        userPromptParts.push(
          `추가된 ${dto.addedScrapIds.length}개의 스크랩 자료를 본문에 통합해주세요.`,
        );
      }
      if (dto.removedScrapIds && dto.removedScrapIds.length > 0) {
        userPromptParts.push(
          `${dto.removedScrapIds.length}개의 스크랩 자료를 제거한 내용으로 조정해주세요.`,
        );
      }
      if (!userPromptParts.length) {
        userPromptParts.push('아티클을 개선하고 업데이트해주세요.');
      }

      const userPrompt = userPromptParts.join(' ');

      // Step 11: Format additional scraps for gRPC
      const additionalScraps = scrapsWithComments.map((item) => ({
        id: item.scrap.scrapId,
        title: item.scrap.title,
        url: item.scrap.url,
        content: item.scrap.content,
        userComment: item.userComment || item.scrap.userComment || '',
      }));

      this.logger.log(
        `🤖 Executing local regeneration workflow: articleId=${articleId}, version=${nextVersion}`,
      );

      const existingScrapsData = article.articleScraps.getItems().map((as) => ({
        id: as.scrap.scrapId,
        title: as.scrap.title,
        url: as.scrap.url,
        content: as.scrap.content,
        userComment: as.userComment || as.scrap.userComment || '',
      }));

      const addedScrapsData = addedScraps.map((scrap) => ({
        id: scrap.scrapId,
        title: scrap.title,
        url: scrap.url,
        content: scrap.content,
        userComment: scrap.userComment || '',
      }));

      const regenerationResult =
        await this.newsletterAgentService.regenerateArticle({
          previousTitle,
          previousContent,
          topic: dto.topic,
          keyInsight: dto.keyInsight,
          userPrompt,
          existingScraps: existingScrapsData,
          addedScraps: addedScrapsData,
          removedScraps: removedScrapsData,
          additionalScraps,
          additionalPdfs: pdfUploadsWithPrompts,
          writingStyleExamples: writingStyleExampleContents,
          generationParams: dto.generationParams,
        });

      // Step 13: Create new ArticleArchive version
      const newArchive = new ArticleArchive();
      newArchive.title = regenerationResult.title;
      newArchive.content = regenerationResult.content;
      newArchive.versionNumber = nextVersion;
      newArchive.article = article;

      await trx.persistAndFlush([article, newArchive]);

      this.logger.log(
        `✅ Article regeneration completed: articleId=${articleId}, version=${nextVersion}, duration=${Date.now() - startTime}ms`,
      );

      // Step 12: Refresh and return
      await trx.refresh(article, {
        populate: ['user', 'writingStyle', 'articleScraps.scrap', 'archives'],
      });

      // Return formatted response
      const sortedArchives = article.archives
        .getItems()
        .sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0));

      const latestVersion = sortedArchives[0];

      return {
        articleId: article.articleId,
        title: latestVersion?.title || article.topic,
        content: latestVersion?.content || '',
        contentFormat: latestVersion?.contentFormat || 'markdown',
        topic: article.topic,
        keyInsight: article.keyInsight,
        generationParams: article.generationParams,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
        user: article.user,
        writingStyleId: article.writingStyle?.id,
        writingStyleName: article.writingStyle?.name,
        scraps: article.articleScraps.getItems().map((as) => ({
          scrapId: as.scrap.scrapId,
          title: as.scrap.title,
          url: as.scrap.url,
          content: as.scrap.content,
          userComment: as.userComment || as.scrap.userComment,
          createdAt: as.scrap.createdAt,
        })),
        archives: sortedArchives.map((archive) => ({
          archiveId: archive.articleArchiveId,
          title: archive.title,
          content: archive.content,
          contentFormat: archive.contentFormat || 'markdown',
          versionNumber: archive.versionNumber,
          createdAt: archive.createdAt,
        })),
      };
    });
  }

  /**
   * V3: 기존 아티클 재생성 (스트리밍)
   */
  regenerateArticleV3Stream(
    articleId: string,
    userId: string,
    dto: RegenerateArticleV3Dto,
  ): Observable<MessageEvent> {
    return new Observable((observer) => {
      // Main async function
      (async () => {
        let article: Article | null = null;

        try {
          this.logger.log(
            `📡 Starting streaming article regeneration for articleId=${articleId}, userId=${userId}`,
          );

          // Variables to capture scrap changes for AI context
          let removedScrapsData: Array<{
            id: string;
            title: string;
            url: string;
            content: string;
            userComment: string;
          }> = [];

          // PDF uploads variables (declared outside transaction for later use)
          let pdfUploadsWithPrompts: Array<{
            url: string;
            usagePrompt: string;
            aiContent: string;
          }> = [];
          let uploadScraps: Scrap[] = [];
          const usagePromptByIdForPdf = new Map<string, string>();

          // Transaction for validation and update
          await this.em.transactional(async (trx) => {
            // Step 1: Fetch and validate article ownership
            article = await trx.findOne(
              Article,
              { articleId, user: { userId } as any },
              {
                populate: [
                  'user',
                  'writingStyle',
                  'articleScraps.scrap',
                  'archives',
                ],
              },
            );

            if (!article) {
              throw new NotFoundException(
                `Article with ID ${articleId} not found or you don't have access`,
              );
            }

            // Step 2: Validate scraps if provided
            let addedScraps: Scrap[] = [];
            if (dto.addedScrapIds && dto.addedScrapIds.length > 0) {
              addedScraps = await trx.find(Scrap, {
                ...this.buildScrapIdFilter(dto.addedScrapIds),
                user: { userId } as any,
                isDeleted: false,
              });

              if (addedScraps.length !== dto.addedScrapIds.length) {
                const foundIds = addedScraps.map((s) => s.scrapId);
                const missingIds = dto.addedScrapIds.filter(
                  (id) => !foundIds.includes(id),
                );
                throw new BadRequestException(
                  `Scraps not found or inaccessible: ${missingIds.join(', ')}`,
                );
              }
            }

            // Validate scraps to be removed AND capture their data for AI
            if (dto.removedScrapIds && dto.removedScrapIds.length > 0) {
              const existingArticleScraps = await trx.find(
                ArticleScrap,
                {
                  article: { articleId: article.articleId },
                  scrap: this.buildScrapIdFilter(dto.removedScrapIds) as any,
                },
                {
                  populate: ['scrap'], // Important: populate scrap details
                },
              );

              if (existingArticleScraps.length !== dto.removedScrapIds.length) {
                const foundIds = existingArticleScraps.map((as) => as.scrap.scrapId);
                const missingIds = dto.removedScrapIds.filter(
                  (id) => !foundIds.includes(id),
                );
                throw new BadRequestException(
                  `Scrap IDs not associated with this article: [${missingIds.join(', ')}]`,
                );
              }

              // Capture removed scrap data before deletion
              removedScrapsData = existingArticleScraps.map((as) => ({
                id: as.scrap.scrapId,
                title: as.scrap.title,
                url: as.scrap.url,
                content: as.scrap.content,
                userComment: as.userComment || as.scrap.userComment || '',
              }));
            }

            // Step 3: Validate and update WritingStyle
            if (dto.writingStyleId !== undefined) {
              if (dto.writingStyleId === null) {
                article.writingStyle = undefined;
              } else {
                const writingStyle = await trx.findOne(WritingStyle, {
                  id: dto.writingStyleId,
                  user: { userId } as any,
                });
                if (!writingStyle) {
                  throw new NotFoundException(
                    `WritingStyle with ID ${dto.writingStyleId} not found`,
                  );
                }
                article.writingStyle = writingStyle;
              }
            }

            // Step 4: Update article metadata
            if (dto.topic !== undefined) {
              article.topic = dto.topic;
            }
            if (dto.keyInsight !== undefined) {
              article.keyInsight = dto.keyInsight;
            }
            if (dto.generationParams !== undefined) {
              article.generationParams = dto.generationParams;
            }

            // Step 4.5: Prepare PDF uploads (before Step 5 so uploadScraps is available)
            if (dto.uploadWithUsagePrompt && dto.uploadWithUsagePrompt.length > 0) {
              const uploads = dto.uploadWithUsagePrompt;
              const scrapIds = uploads.map((u) => u.uploadedFileId);

              uploads.forEach((u) =>
                usagePromptByIdForPdf.set(u.uploadedFileId, u.usagePrompt ?? ''),
              );

              uploadScraps = await trx.find(Scrap, {
                ...this.buildScrapIdFilter(scrapIds),
                user: { userId } as any,
                isDeleted: false,
              });

              pdfUploadsWithPrompts = uploadScraps
                .map((scrap) => {
                  const url = scrap.filePath || scrap.url;
                  if (!url) return null;
                  return {
                    url,
                    usagePrompt: usagePromptByIdForPdf.get(scrap.scrapId) || '',
                    aiContent: scrap.aiContent || '',
                  };
                })
                .filter(
                  (
                    item,
                  ): item is { url: string; usagePrompt: string; aiContent: string } =>
                    item !== null,
                );
            }

            // Step 5: Synchronize ArticleScrap associations (incremental)
            // Remove specified scraps
            if (dto.removedScrapIds && dto.removedScrapIds.length > 0 && article) {
              // With orphanRemoval: true, just remove from collection
              // MikroORM will handle database deletion automatically on flush
              const itemsToRemove = article.articleScraps
                .getItems()
                .filter((as) => dto.removedScrapIds!.includes(as.scrap.scrapId));
              itemsToRemove.forEach((as) => article!.articleScraps.remove(as));
            }

            // Add new web scraps
            if (dto.addedScrapIds && dto.addedScrapIds.length > 0 && article) {
              const newArticleScraps = addedScraps.map((scrap) => {
                const articleScrap = new ArticleScrap();
                articleScrap.article = article!;
                articleScrap.scrap = scrap;
                articleScrap.userComment = scrap.userComment; // Use scrap's default comment
                return articleScrap;
              });

              // Add new items to the collection
              newArticleScraps.forEach((as) => article!.articleScraps.add(as));
            }

            // Add PDF scraps (새로 추가된 PDF)
            if (uploadScraps && uploadScraps.length > 0 && article) {
              const existingScrapIds = new Set(
                article.articleScraps.getItems().map((as) => as.scrap.scrapId),
              );

              const newPdfScraps = uploadScraps.filter(
                (scrap) => !existingScrapIds.has(scrap.scrapId),
              );

              if (newPdfScraps.length > 0) {
                const newPdfArticleScraps = newPdfScraps.map((scrap) => {
                  const articleScrap = new ArticleScrap();
                  articleScrap.article = article!;
                  articleScrap.scrap = scrap;
                  articleScrap.userComment = usagePromptByIdForPdf.get(scrap.scrapId);
                  return articleScrap;
                });

                newPdfArticleScraps.forEach((as) => article!.articleScraps.add(as));
              }
            }

            // Update status to processing
            article.generationStatus = 'processing';
            await trx.persistAndFlush(article);
          });

          // Reload article with fresh data
          article = await this.articleRepository.findOne(
            { articleId },
            {
              populate: [
                'user',
                'writingStyle',
                'articleScraps.scrap',
                'archives',
              ],
            },
          );

          if (!article) {
            throw new Error('Failed to reload article after update');
          }

          this.logger.log(
            `✅ Article updated, starting regeneration stream for ID: ${article.articleId}`,
          );

          // Prepare scrap data with distinction between added, existing, and removed
          const allCurrentScraps = article.articleScraps.getItems();

          // Scraps that were newly added in this regeneration
          const addedScrapsData =
            dto.addedScrapIds && dto.addedScrapIds.length > 0
              ? allCurrentScraps
                  .filter((as) => dto.addedScrapIds!.includes(as.scrap.scrapId))
                  .map((as) => ({
                    id: as.scrap.scrapId,
                    title: as.scrap.title,
                    url: as.scrap.url,
                    content: as.scrap.content,
                    userComment: as.userComment || as.scrap.userComment || '',
                  }))
              : [];

          // Scraps that existed before this regeneration
          const existingScrapsData = allCurrentScraps
            .filter((as) => !dto.addedScrapIds?.includes(as.scrap.scrapId))
            .map((as) => ({
              id: as.scrap.scrapId,
              title: as.scrap.title,
              url: as.scrap.url,
              content: as.scrap.content,
              userComment: as.userComment || as.scrap.userComment || '',
            }));

          // Keep for backward compatibility and general processing
          const scrapsWithComments = allCurrentScraps.map((as) => ({
            scrap: as.scrap,
            userComment: as.userComment,
          }));

          // Prepare writing style examples
          let writingStyleExampleContents: string[] = [];
          if (article.writingStyle) {
            const writingStyleExamples =
              await this.writingStyleExampleRepository.find(
                {
                  writingStyle: {
                    id: article.writingStyle.id,
                    user: article.user,
                  },
                },
                { populate: ['writingStyle'] },
              );
            writingStyleExampleContents = writingStyleExamples.map(
              (example) => example.content,
            );
          }

          // Get previous content and title for regeneration
          const latestArchiveForStream = article.archives
            .getItems()
            .sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0))[0];

          if (!latestArchiveForStream) {
            throw new NotFoundException(
              'No previous version found for regeneration',
            );
          }

          const previousTitle = latestArchiveForStream.title || article.topic;
          const previousContent = latestArchiveForStream.content || '';

          // Build user prompt from changes
          const userPromptParts: string[] = [];
          if (dto.topic && dto.topic !== article.topic) {
            userPromptParts.push(`주제를 "${dto.topic}"로 변경해주세요.`);
          }
          if (dto.keyInsight && dto.keyInsight !== article.keyInsight) {
            userPromptParts.push(
              `핵심 인사이트를 "${dto.keyInsight}"로 반영해주세요.`,
            );
          }
          if (dto.addedScrapIds && dto.addedScrapIds.length > 0) {
            userPromptParts.push(
              `추가된 ${dto.addedScrapIds.length}개의 스크랩 자료를 본문에 통합해주세요.`,
            );
          }
          if (dto.removedScrapIds && dto.removedScrapIds.length > 0) {
            userPromptParts.push(
              `${dto.removedScrapIds.length}개의 스크랩 자료를 제거한 내용으로 조정해주세요.`,
            );
          }
          if (!userPromptParts.length) {
            userPromptParts.push('아티클을 개선하고 업데이트해주세요.');
          }

          const userPrompt = userPromptParts.join(' ');

          // Format additional scraps for gRPC
          const additionalScraps = scrapsWithComments.map((item) => ({
            id: item.scrap.scrapId,
            title: item.scrap.title,
            url: item.scrap.url,
            content: item.scrap.content,
            userComment: item.userComment || item.scrap.userComment || '',
          }));

          // Send progress start event
          observer.next({
            data: {
              type: EventType.PROGRESS,
              timestamp: Date.now(),
              node: 'workflow',
              message_ko: '아티클 재생성을 시작합니다.',
              message_en: 'Starting article regeneration...',
              progress: 10,
            },
          } as MessageEvent);

          let regenerationResult: RegenerateArticleOutput;
          try {
            regenerationResult =
              await this.newsletterAgentService.regenerateArticle({
                previousTitle,
                previousContent,
                topic: dto.topic,
                keyInsight: dto.keyInsight,
                userPrompt,
                existingScraps: existingScrapsData,
                addedScraps: addedScrapsData,
                removedScraps: removedScrapsData,
                additionalScraps,
                additionalPdfs: pdfUploadsWithPrompts,
                writingStyleExamples: writingStyleExampleContents,
                generationParams: dto.generationParams,
              });
          } catch (error) {
            observer.next({
              data: {
                type: EventType.ERROR,
                message:
                  (error as Error)?.message || 'Regeneration failed',
                error_type: (error as Error)?.name ?? 'Error',
                timestamp: Date.now(),
              },
            } as MessageEvent);
            throw error;
          }

          // Send progress event
          observer.next({
            data: {
              type: EventType.PROGRESS,
              timestamp: Date.now(),
              node: 'database',
              message_ko: '재생성된 내용을 저장합니다.',
              message_en: 'Saving regenerated content...',
              progress: 90,
            },
          } as MessageEvent);

          // Handle completion - save to database
          if (regenerationResult.title && regenerationResult.content && article) {
            try {
              // Calculate next version number
              const existingVersions = article.archives
                .getItems()
                .map((a) => a.versionNumber || 0);
              const maxVersion =
                existingVersions.length > 0
                  ? Math.max(...existingVersions)
                  : 0;
              const nextVersion = maxVersion + 1;

              // Save results to database
              const archive = new ArticleArchive();
              archive.title = regenerationResult.title;
              archive.content = regenerationResult.content;
              archive.versionNumber = nextVersion;
              archive.article = article;

              article.generationStatus = 'completed';
              await this.em.persistAndFlush([archive, article]);

              this.logger.log(
                `✅ Regeneration complete: articleId=${article.articleId}, version=${nextVersion}`,
              );

              // Send Slack notification
              try {
                await this.slackService.notifyArticleGeneration({
                  articleId: article.articleId,
                  title: regenerationResult.title,
                  topic: article.topic,
                  keyInsight: article.keyInsight,
                  userEmail: article.user.email,
                  userName: article.user.name,
                  userId: article.user.userId,
                  contentLength: regenerationResult.content.length,
                  version: `V3-Regenerate-v${nextVersion}`,
                  createdAt: article.createdAt,
                });
              } catch (slackError) {
                this.logger.warn(
                  'Failed to send Slack notification:',
                  slackError,
                );
              }

              // Send final complete event to client
              observer.next({
                data: {
                  type: EventType.COMPLETE,
                  timestamp: Date.now(),
                  title: regenerationResult.title,
                  content: regenerationResult.content,
                  changesSummary: regenerationResult.changesSummary,
                  analysis_reason: 'Article regenerated successfully.',
                  warnings: [],
                },
              } as MessageEvent);
            } catch (error) {
              this.logger.error('Error saving regeneration result:', error);
              if (article) {
                article.generationStatus = 'failed';
                await this.em.persistAndFlush(article);
              }
              observer.next({
                data: {
                  type: 'error',
                  message: error.message || 'Failed to save result',
                },
              } as MessageEvent);
            }
          }

          // Complete the observable
          observer.complete();
        } catch (error) {
          this.logger.error(
            '❌ Streaming article regeneration failed:',
            error,
          );

          // Update article status to failed
          if (article) {
            try {
              article.generationStatus = 'failed';
              await this.em.persistAndFlush(article);
            } catch (updateError) {
              this.logger.error(
                'Failed to update article status:',
                updateError,
              );
            }
          }

          // Send error to client
          observer.next({
            data: {
              type: EventType.ERROR,
              timestamp: Date.now(),
              message: error.message || 'Regeneration streaming failed',
              error_type: (error as Error)?.name ?? 'Error',
            },
          } as MessageEvent);

          observer.error(error);
        }
      })();
    });
  }

  /**
   * Build a filter query for scrap IDs, handling both UUID and legacy integer IDs
   * @param scrapIds Array of scrap identifiers (UUIDs or legacy integers)
   * @returns FilterQuery for scraps that handles both ID types
   */
  private buildScrapIdFilter(
    scrapIds: ScrapIdentifier[],
  ): FilterQuery<Scrap> {
    if (!scrapIds || scrapIds.length === 0) {
      return { scrapId: { $in: [] } };
    }

    // Separate UUIDs and legacy IDs
    const uuids = scrapIds.filter(
      (id) => typeof id === 'string' && isScrapUuid(id),
    );
    const legacyIds = scrapIds.filter((id) => typeof id === 'number');

    // Build OR condition for both UUID and legacy IDs
    const idConditions: any[] = [];
    if (uuids.length > 0) {
      idConditions.push({ scrapId: { $in: uuids } });
    }
    if (legacyIds.length > 0) {
      idConditions.push({ legacyScrapId: { $in: legacyIds } });
    }

    if (idConditions.length === 0) {
      return { scrapId: { $in: [] } };
    }

    if (idConditions.length === 1) {
      return idConditions[0];
    }

    return { $or: idConditions } as FilterQuery<Scrap>;
  }

  private async getUserOrThrow(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ userId });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }
    return user;
  }
}
