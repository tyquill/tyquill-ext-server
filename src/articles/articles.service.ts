import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateArticleDto } from '../api/articles/dto/create-article.dto';
import { UpdateArticleDto } from '../api/articles/dto/update-article.dto';
import { GenerateArticleDto } from '../api/articles/dto/generate-article.dto';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Article } from './entities/article.entity';
import { ArticleArchive } from '../article-archive/entities/article-archive.entity';
import { Scrap } from '../scraps/entities/scrap.entity';
import { User } from '../users/entities/user.entity';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { AiGenerationService } from './ai-generation.service';

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
    private readonly aiGenerationService: AiGenerationService,
  ) {}

  async create(createArticleDto: CreateArticleDto): Promise<Article> {
    const article = Article.fromCreateArticleDto(createArticleDto);
    await this.em.persistAndFlush(article);
    return article;
  }

  /**
   * AI를 사용하여 아티클을 생성합니다
   */
  async generateArticle(userId: number, generateDto: GenerateArticleDto): Promise<Article> {
    // 사용자 확인
    const user = await this.userRepository.findOne({ userId });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    // 스크랩 데이터 조회
    const scraps = await this.scrapRepository.find({
      scrapId: { $in: generateDto.scrapIds },
      user: user,
    });

    if (scraps.length === 0) {
      throw new NotFoundException('선택된 스크랩을 찾을 수 없습니다');
    }

    // AI 아티클 생성
    const generatedContent = await this.aiGenerationService.generateArticle({
      topic: generateDto.topic,
      keyInsight: generateDto.keyInsight,
      scraps,
      userComment: generateDto.userComment,
      generationParams: generateDto.generationParams,
    });

    // Article 엔티티 생성
    const article = new Article();
    article.topic = generateDto.topic;
    article.keyInsight = generateDto.keyInsight;
    article.generationParams = generateDto.generationParams;
    article.user = user;

    // 스크랩과 연결
    scraps.forEach(scrap => {
      scrap.article = article;
    });

    await this.em.persistAndFlush(article);

    // 첫 번째 버전 생성
    await this.createArticleVersion(article, generatedContent.title, generatedContent.content);

    return article;
  }

  /**
   * 아티클의 새로운 버전을 생성합니다
   */
  async createArticleVersion(article: Article, title: string, content: string): Promise<ArticleArchive> {
    // 현재 최대 버전 번호 조회
    const maxVersionArchive = await this.articleArchiveRepository.findOne(
      { article },
      { orderBy: { versionNumber: 'DESC' } }
    );

    const newVersionNumber = maxVersionArchive ? (maxVersionArchive.versionNumber || 0) + 1 : 1;

    const archive = new ArticleArchive();
    archive.title = title;
    archive.content = content;
    archive.versionNumber = newVersionNumber;
    archive.article = article;

    await this.em.persistAndFlush(archive);
    return archive;
  }

  async findAll(): Promise<Article[]> {
    return await this.articleRepository.findAll({
      populate: ['archives', 'user', 'scraps']
    });
  }

  async findOne(articleId: number): Promise<Article | null> {
    return await this.articleRepository.findOne({ articleId }, {
      populate: ['archives', 'user', 'scraps']
    });
  }

  /**
   * 아티클의 모든 버전을 조회합니다
   */
  async findVersions(articleId: number): Promise<ArticleArchive[]> {
    const article = await this.articleRepository.findOne({ articleId });
    if (!article) {
      throw new NotFoundException('아티클을 찾을 수 없습니다');
    }

    return await this.articleArchiveRepository.find(
      { article },
      { orderBy: { versionNumber: 'DESC' } }
    );
  }

  async update(articleId: number, updateArticleDto: UpdateArticleDto): Promise<Article | null> {
    const article = await this.articleRepository.findOne({ articleId });
    if (!article) {
      return null;
    }
    Object.assign(article, updateArticleDto);
    await this.em.flush();
    return article;
  }

  async remove(articleId: number): Promise<void> {
    const article = await this.articleRepository.findOne({ articleId });
    if (article) {
      await this.em.removeAndFlush(article);
    }
  }
}
