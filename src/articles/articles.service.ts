import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateArticleDto } from '../api/articles/dto/create-article.dto';
import {
  GenerateArticleDto,
  GenerateArticleResponse,
  ScrapWithOptionalComment,
} from '../api/articles/dto/generate-article.dto';
import { UpdateArticleDto } from '../api/articles/dto/update-article.dto';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Article } from './entities/article.entity';
import { ArticleArchive } from '../article-archive/entities/article-archive.entity';
import { Scrap } from '../scraps/entities/scrap.entity';
import { User } from '../users/entities/user.entity';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { NewsletterWorkflowService } from '../agent/newsletter-workflow.service';

@Injectable()
export class ArticlesService {
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
    private readonly newsletterWorkflowService: NewsletterWorkflowService,
  ) {}

  /**
   * 페이지 콘텐츠를 분석하여 구조화된 템플릿을 반환합니다.
   */
  async analyzePageStructure(content: string): Promise<any> {
    console.log('analyzePageStructure');
    const result =
      await this.newsletterWorkflowService.analyzePageStructure(content);

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

    // AI 뉴스레터 생성
    const newsletterResult =
      await this.newsletterWorkflowService.generateNewsletter({
        topic: generateDto.topic,
        keyInsight: generateDto.keyInsight,
        scrapsWithComments,
        generationParams: generateDto.generationParams,
        articleStructureTemplate: generateDto.articleStructureTemplate,
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

    return {
      id: article.articleId,
      title: newsletterResult.title,
      content: newsletterResult.content,
      createdAt: article.createdAt,
      userId: user.userId,
    } as GenerateArticleResponse;
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
      content: article.getLatestContent() || '',
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
}
