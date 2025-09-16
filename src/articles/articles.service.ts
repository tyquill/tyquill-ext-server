import { Injectable, NotFoundException, Logger } from '@nestjs/common';
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
import { UpdateArticleDto } from '../api/articles/dto/update-article.dto';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Article } from './entities/article.entity';
import { ArticleArchive } from '../article-archive/entities/article-archive.entity';
import { Scrap } from '../scraps/entities/scrap.entity';
import { User } from '../users/entities/user.entity';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { NewsletterAgentService } from '../agents/services/newsletter-agent.service';
import { WritingStyleExample } from 'src/writing-styles/entities/writing-style-example.entity';
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
    @InjectRepository(Scrap)
    private readonly scrapRepository: EntityRepository<Scrap>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    private readonly newsletterAgentService: NewsletterAgentService,
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
  async create(createArticleDto: CreateArticleDto): Promise<Article> {
    const user = await this.userRepository.findOne({
      userId: createArticleDto.userId,
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const article = new Article();
    article.topic = createArticleDto.topic;
    article.keyInsight = createArticleDto.keyInsights;
    article.generationParams = createArticleDto.generationParams;
    article.user = user;

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
    userId: number,
    generateDto: GenerateArticleDto,
  ): Promise<GenerateArticleResponse> {
    // 사용자 검증
    const user = await this.userRepository.findOne({ userId: userId });
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
   * 특정 아티클 조회
   */
  async findOne(articleId: number): Promise<any> {
    const article = await this.articleRepository.findOne(
      { articleId },
      {
        populate: ['user', 'archives'],
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

    return {
      articleId: article.articleId,
      title: article.getLatestTitle() || article.topic,
      content: article.getLatestContent() || '',
      topic: article.topic,
      keyInsight: article.keyInsight,
      generationParams: article.generationParams,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      user: article.user,
      archives: sortedArchives.map((archive) => ({
        archiveId: archive.articleArchiveId,
        title: archive.title,
        content: archive.content,
        versionNumber: archive.versionNumber,
        createdAt: archive.createdAt,
      })),
    };
  }

  /**
   * 사용자별 아티클 조회
   */
  async findByUser(
    userId: number,
    sortBy?: 'created_at' | 'updated_at',
    sortOrder?: 'ASC' | 'DESC',
  ): Promise<any[]> {
    const user = await this.userRepository.findOne({ userId });

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
    articleId: number,
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
  async remove(articleId: number): Promise<void> {
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
  async archive(articleId: number): Promise<ArticleArchive> {
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
   * 아티클 검색
   */
  async search(query: string, userId?: number): Promise<Article[]> {
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
  async removeBatch(articleIds: number[]): Promise<void> {
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
    userId: number,
    generateDto: GenerateArticleV2Dto,
  ): Promise<GenerateArticleV2Response> {
    this.logger.log(
      `🚀 Starting V2 async article generation for user ${userId}`,
    );

    // 사용자 검증
    const user = await this.userRepository.findOne({ userId: userId });
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
    articleId: number,
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
  async findByUserV2(userId: number): Promise<any[]> {
    const user = await this.userRepository.findOne({ userId });

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
    articleId: number,
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

      // 아티클 상태 업데이트
      article.generationStatus = 'completed';

      await this.em.persistAndFlush([archive, article]);

      this.logger.log(
        `🎉 Background generation completed for articleId=${articleId}`,
      );

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
    userId: number,
    generateDto: GenerateArticleV3Dto,
  ): Promise<GenerateArticleV2Response> {
    this.logger.log(
      `🚀 Starting V3 async article generation for user ${userId}`,
    );

    // 사용자 검증
    const user = await this.userRepository.findOne({ userId: userId });
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
    articleId: number,
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
  async findByUserV3(userId: number): Promise<any[]> {
    const user = await this.userRepository.findOne({ userId });

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
    articleId: number,
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

      if (
        generateDto.uploadWithUsagePrompt &&
        generateDto.uploadWithUsagePrompt.length > 0
      ) {
        // Treat uploads as scraps with file metadata; uploadedFileId corresponds to scrapId
        const uploads = generateDto.uploadWithUsagePrompt;
        const scrapIds = uploads.map((u) => u.uploadedFileId);

        // Build usagePrompt lookup for O(1)
        const usagePromptById = new Map<number, string>();
        for (const u of uploads)
          usagePromptById.set(u.uploadedFileId, u.usagePrompt);

        // Fetch only non-deleted scraps for the user
        const uploadScraps = await this.scrapRepository.find({
          scrapId: { $in: scrapIds },
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

      // 아티클 상태 업데이트
      article.generationStatus = 'completed';

      await this.em.persistAndFlush([archive, article]);

      this.logger.log(
        `🎉 V3 Background generation completed for articleId=${articleId}`,
      );

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
}
