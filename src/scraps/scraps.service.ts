import { Injectable } from '@nestjs/common';
import { CreateScrapDto } from '../api/scraps/dto/create-scrap.dto';
import { UpdateScrapDto } from '../api/scraps/dto/update-scrap.dto';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { Scrap } from './entities/scrap.entity';
import { InjectRepository } from '@mikro-orm/nestjs';
import { User } from '../users/entities/user.entity';
import { Article } from '../articles/entities/article.entity';
import { ScrapCombinationService } from '../agent/scrap-combination.service';

export interface SearchOptions {
  query?: string;
  userId?: number;
  articleId?: number;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  sortBy?: 'created_at' | 'updated_at' | 'title';
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

@Injectable()
export class ScrapsService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(Scrap)
    private readonly scrapRepository: EntityRepository<Scrap>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    @InjectRepository(Article)
    private readonly articleRepository: EntityRepository<Article>,
    private readonly scrapCombinationService: ScrapCombinationService,
  ) {}

  async create(
    createScrapDto: CreateScrapDto,
    userId: number,
    articleId?: number,
  ): Promise<Scrap> {
    const user = await this.userRepository.findOne({ userId });
    if (!user) {
      throw new Error('User not found');
    }

    const article = articleId
      ? await this.articleRepository.findOne({ articleId })
      : null;
    if (articleId && !article) {
      throw new Error('Article not found');
    }

    const scrap = new Scrap();
    scrap.url = createScrapDto.url;
    scrap.title = createScrapDto.title;
    scrap.content = createScrapDto.content;
    scrap.htmlContent = '';
    scrap.userComment = createScrapDto.userComment;
    scrap.user = user;

    if (article) {
      scrap.article = article;
    }

    await this.em.persistAndFlush(scrap);
    return scrap;
  }

  async findAll(userId?: number): Promise<Scrap[]> {
    const query = userId ? { user: { userId } } : {};

    return await this.scrapRepository.find(query, {
      populate: ['user', 'article', 'tags'],
    });
  }

  async findOne(scrapId: number): Promise<Scrap | null> {
    return await this.scrapRepository.findOne(
      { scrapId },
      {
        populate: ['user', 'article', 'tags'],
      },
    );
  }

  async findByUser(
    userId: number,
    sortBy?: 'created_at' | 'updated_at' | 'title',
    sortOrder?: 'ASC' | 'DESC',
  ): Promise<Scrap[]> {
    const query = { user: { userId } };
    let orderBy: any = { createdAt: 'DESC' };
    
    switch (sortBy) {
      case 'created_at':
        orderBy = { createdAt: sortOrder };
        break;
      case 'updated_at':
        orderBy = { updatedAt: sortOrder };
        break;
      case 'title':
        orderBy = { title: sortOrder };
        break;
    }

    return await this.scrapRepository.find(query, {
      populate: ['user', 'article', 'tags'],
      orderBy: orderBy,
    });
  }

  async findByArticle(articleId: number): Promise<Scrap[]> {
    return await this.scrapRepository.find(
      { article: { articleId } },
      { populate: ['user', 'article', 'tags'] },
    );
  }

  async update(
    scrapId: number,
    updateScrapDto: UpdateScrapDto,
  ): Promise<Scrap | null> {
    const scrap = await this.scrapRepository.findOne({ scrapId });
    if (!scrap) {
      return null;
    }

    // htmlContent가 변경되면 content도 다시 생성
    if (
      updateScrapDto.htmlContent &&
      updateScrapDto.htmlContent !== scrap.htmlContent
    ) {
      const extractedText = this.extractTextFromHtml(
        updateScrapDto.htmlContent,
      );
      const aiSummary = await this.generateAiSummary(extractedText);
      scrap.content = aiSummary;
    }

    Object.assign(scrap, updateScrapDto);
    await this.em.flush();
    return scrap;
  }

  async remove(scrapId: number): Promise<void> {
    const scrap = await this.scrapRepository.findOne({ scrapId });
    if (scrap) {
      await this.em.removeAndFlush(scrap);
    }
  }

  async search(query: string, userId?: number): Promise<Scrap[]> {
    const qb = this.em.createQueryBuilder(Scrap, 's');

    qb.where({
      $or: [
        { title: { $ilike: `%${query}%` } },
        { content: { $ilike: `%${query}%` } },
        { userComment: { $ilike: `%${query}%` } },
      ],
    });

    if (userId) {
      qb.andWhere({ user: { userId } });
    }

    qb.leftJoinAndSelect('s.user', 'u')
      .leftJoinAndSelect('s.article', 'a')
      .leftJoinAndSelect('s.tags', 't');

    return await qb.getResult();
  }

  /**
   * 고급 검색 및 필터링
   */
  async advancedSearch(
    searchOptions: SearchOptions,
    paginationOptions: PaginationOptions = {},
  ): Promise<{ scraps: Scrap[]; total: number; page: number; limit: number }> {
    const qb = this.em.createQueryBuilder(Scrap, 's');

    // 기본 조인
    qb.leftJoinAndSelect('s.user', 'u')
      .leftJoinAndSelect('s.article', 'a')
      .leftJoinAndSelect('s.tags', 't');

    // 텍스트 검색 (풀텍스트 검색)
    if (searchOptions.query) {
      const searchTerm = searchOptions.query.trim();
      qb.andWhere({
        $or: [
          { title: { $ilike: `%${searchTerm}%` } },
          { content: { $ilike: `%${searchTerm}%` } },
          { userComment: { $ilike: `%${searchTerm}%` } },
          { url: { $ilike: `%${searchTerm}%` } },
        ],
      });
    }

    // 사용자 필터
    if (searchOptions.userId) {
      qb.andWhere({ user: { userId: searchOptions.userId } });
    }

    // 기사 필터
    if (searchOptions.articleId) {
      qb.andWhere({ article: { articleId: searchOptions.articleId } });
    }

    // 태그 기반 필터링
    if (searchOptions.tags && searchOptions.tags.length > 0) {
      qb.andWhere({
        tags: {
          name: { $in: searchOptions.tags },
        },
      });
    }

    // 날짜 범위 필터
    if (searchOptions.dateFrom) {
      qb.andWhere({ createdAt: { $gte: searchOptions.dateFrom } });
    }
    if (searchOptions.dateTo) {
      qb.andWhere({ createdAt: { $lte: searchOptions.dateTo } });
    }

    // 정렬
    const sortBy = searchOptions.sortBy || 'created_at';
    const sortOrder = searchOptions.sortOrder || 'DESC';
    qb.orderBy({ [sortBy]: sortOrder });

    // 페이지네이션
    const page = paginationOptions.page || 1;
    const limit = paginationOptions.limit || 20;
    const offset = (page - 1) * limit;

    // 총 개수 조회 (페이지네이션용)
    const totalQb = qb.clone();
    const total = await totalQb.getCount();

    // 페이지네이션 적용
    qb.limit(limit).offset(offset);

    const scraps = await qb.getResult();

    return {
      scraps,
      total,
      page,
      limit,
    };
  }

  /**
   * 태그 기반 필터링
   */
  async findByTags(
    tagNames: string[],
    userId?: number,
    matchAll: boolean = false,
  ): Promise<Scrap[]> {
    const qb = this.em.createQueryBuilder(Scrap, 's');

    qb.leftJoinAndSelect('s.user', 'u')
      .leftJoinAndSelect('s.article', 'a')
      .leftJoinAndSelect('s.tags', 't');

    if (matchAll) {
      // 모든 태그가 포함된 스크랩 (AND 조건)
      for (const tagName of tagNames) {
        qb.andWhere({ tags: { name: tagName } });
      }
    } else {
      // 하나 이상의 태그가 포함된 스크랩 (OR 조건)
      qb.andWhere({ tags: { name: { $in: tagNames } } });
    }

    if (userId) {
      qb.andWhere({ user: { userId } });
    }

    return await qb.getResult();
  }

  /**
   * HTML에서 순수 텍스트를 추출합니다
   */
  private extractTextFromHtml(htmlContent: string): string {
    if (!htmlContent) {
      return '';
    }

    // 기본적인 HTML 태그 제거
    const text = htmlContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // 스크립트 제거
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // 스타일 제거
      .replace(/<[^>]*>/g, ' ') // 모든 HTML 태그 제거
      .replace(/&nbsp;/g, ' ') // HTML 엔티티 변환
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ') // 연속된 공백 제거
      .trim();

    return text;
  }

  /**
   * 추출된 텍스트를 AI를 통해 요약합니다
   */
  private async generateAiSummary(text: string): Promise<string> {
    if (!text || text.length < 50) {
      return text; // 짧은 텍스트는 그대로 반환
    }

    try {
      // ScrapCombinationService의 AI 요약 기능 활용
      const summary =
        await this.scrapCombinationService['createAiSummary'](text);
      return summary || text;
    } catch (error) {
      console.error('AI 요약 생성 실패:', error);
      // 실패 시 원본 텍스트의 일부만 반환
      return text.length > 500 ? text.substring(0, 500) + '...' : text;
    }
  }
}
