import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateArticleDto } from '../api/articles/dto/create-article.dto';
import { GenerateArticleDto, ScrapWithOptionalComment } from '../api/articles/dto/generate-article.dto';
import { UpdateArticleDto } from '../api/articles/dto/update-article.dto';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Article } from './entities/article.entity';
import { ArticleArchive } from '../article-archive/entities/article-archive.entity';
import { Scrap } from '../scraps/entities/scrap.entity';
import { User } from '../users/entities/user.entity';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { ScrapCombinationService } from '../agent/scrap-combination.service';
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
    private readonly scrapCombinationService: ScrapCombinationService,
    private readonly newsletterWorkflowService: NewsletterWorkflowService,
  ) {}

  /**
   * 아티클 생성
   */
  async create(createArticleDto: CreateArticleDto): Promise<Article> {
    const user = await this.userRepository.findOne({ userId: createArticleDto.userId });
    
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
  async generateArticle(userId: number, generateDto: GenerateArticleDto): Promise<any> {
    // 사용자 검증
    const user = await this.userRepository.findOne({ userId: userId });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    // 스크랩 데이터 준비
    let scrapsWithComments: Array<{scrap: Scrap; userComment?: string}> = [];
    
    if (generateDto.scrapWithOptionalComment && generateDto.scrapWithOptionalComment.length > 0) {
      const scraps = await this.scrapRepository.find({ 
        scrapId: { $in: generateDto.scrapWithOptionalComment.map(comment => comment.scrapId) },
        user: user 
      });

      scrapsWithComments = scraps.map((scrap) => {
        const scrapComment = generateDto.scrapWithOptionalComment?.find(
          (comment: ScrapWithOptionalComment) => comment.scrapId === scrap.scrapId
        );
        
        return {
          scrap,
          userComment: scrapComment?.userComment,
        };
      });
    }

    // AI 뉴스레터 생성
    const newsletterResult = await this.newsletterWorkflowService.generateNewsletter({
      topic: generateDto.topic,
      keyInsight: generateDto.keyInsight,
      scrapsWithComments,
      generationParams: generateDto.generationParams,
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
    };
  }

  /**
   * 모든 아티클 조회
   */
  async findAll(): Promise<Article[]> {
    return this.articleRepository.findAll({
      populate: ['user'],
      orderBy: { createdAt: 'DESC' }
    });
  }

  /**
   * 특정 아티클 조회
   */
  async findOne(articleId: number): Promise<Article> {
    const article = await this.articleRepository.findOne({ articleId }, {
      populate: ['user']
    });
    
    if (!article) {
      throw new NotFoundException('아티클을 찾을 수 없습니다.');
    }
    
    return article;
  }

  /**
   * 사용자별 아티클 조회
   */
  async findByUser(userId: number): Promise<Article[]> {
    const user = await this.userRepository.findOne({ userId });
    
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    return this.articleRepository.find({ user }, {
      populate: ['user'],
      orderBy: { createdAt: 'DESC' }
    });
  }

  /**
   * 아티클 업데이트
   */
  async update(articleId: number, updateArticleDto: UpdateArticleDto): Promise<Article> {
    const article = await this.findOne(articleId);
    
    // title이나 content가 변경되면 새로운 아카이브 버전 생성
    if (updateArticleDto.title || updateArticleDto.content) {
      // 기존 최신 아카이브 찾기
      const latestArchive = await this.em.findOne(ArticleArchive, 
        { article: article },
        { orderBy: { versionNumber: 'desc' } }
      );
      
      const newVersionNumber = (latestArchive?.versionNumber || 0) + 1;
      
      const newArchive = new ArticleArchive();
      newArchive.title = updateArticleDto.title || latestArchive?.title || article.topic;
      newArchive.content = updateArticleDto.content || latestArchive?.content || '내용 없음';
      newArchive.versionNumber = newVersionNumber;
      newArchive.article = article;
      
      await this.em.persistAndFlush(newArchive);
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
    return article;
  }

  /**
   * 아티클 삭제
   */
  async remove(articleId: number): Promise<void> {
    const article = await this.findOne(articleId);
    await this.em.removeAndFlush(article);
  }

  /**
   * 아티클 아카이브
   */
  async archive(articleId: number): Promise<ArticleArchive> {
    const article = await this.findOne(articleId);
    
    // 최신 아카이브에서 title과 content 가져오기
    const latestArchive = await this.em.findOne(ArticleArchive, 
      { article: article },
      { orderBy: { versionNumber: 'desc' } }
    );
    
    const archive = new ArticleArchive();
    archive.title = latestArchive?.title || article.topic;
    archive.content = latestArchive?.content || '내용 없음';
    archive.versionNumber = (latestArchive?.versionNumber || 0) + 1;
    archive.article = article;

    await this.em.persistAndFlush(archive);
    await this.em.removeAndFlush(article);

    return archive;
  }


  /**
   * 아티클 검색
   */
  async search(query: string, userId?: number): Promise<Article[]> {
    const whereClause: any = {
      $or: [
        { title: { $like: `%${query}%` } },
        { content: { $like: `%${query}%` } },
        { topic: { $like: `%${query}%` } }
      ]
    };

    if (userId) {
      whereClause.user = { userId };
    }

    return this.articleRepository.find(whereClause, {
      populate: ['user'],
      orderBy: { createdAt: 'DESC' }
    });
  }

  /**
   * 배치 아티클 삭제
   */
  async removeBatch(articleIds: number[]): Promise<void> {
    const articles = await this.articleRepository.find({ articleId: { $in: articleIds } });
    
    if (articles.length !== articleIds.length) {
      throw new NotFoundException('일부 아티클을 찾을 수 없습니다.');
    }

    await this.em.removeAndFlush(articles);
  }
}
