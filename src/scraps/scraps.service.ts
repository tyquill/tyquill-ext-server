import { Injectable } from '@nestjs/common';
import { CreateScrapDto } from '../api/scraps/dto/create-scrap.dto';
import { UpdateScrapDto } from '../api/scraps/dto/update-scrap.dto';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { Scrap } from './entities/scrap.entity';
import { InjectRepository } from '@mikro-orm/nestjs';
import { User } from '../users/entities/user.entity';
import { Article } from '../articles/entities/article.entity';

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
  ) {}

  async create(createScrapDto: CreateScrapDto, userId: number, articleId?: number): Promise<Scrap> {
    const user = await this.userRepository.findOne({ userId });
    if (!user) {
      throw new Error('User not found');
    }

    const article = articleId ? await this.articleRepository.findOne({ articleId }) : null;
    if (!article) {
      throw new Error('Article not found');
    }
    
    const scrap = new Scrap();
    Object.assign(scrap, createScrapDto);
    scrap.user = user;
    if (article) {
      scrap.article = article;
    }
    
    await this.em.persistAndFlush(scrap);
    return scrap;
  }

  async findAll(userId?: number): Promise<Scrap[]> {
    const query = userId 
      ? { user: { userId } }
      : {};
    
    return await this.scrapRepository.find(query, {
      populate: ['user', 'article', 'tags']
    });
  }

  async findOne(scrapId: number): Promise<Scrap | null> {
    return await this.scrapRepository.findOne({ scrapId }, {
      populate: ['user', 'article', 'tags']
    });
  }

  async findByUser(userId: number): Promise<Scrap[]> {
    return await this.scrapRepository.find(
      { user: { userId } },
      { populate: ['user', 'article', 'tags'] }
    );
  }

  async findByArticle(articleId: number): Promise<Scrap[]> {
    return await this.scrapRepository.find(
      { article: { articleId } },
      { populate: ['user', 'article', 'tags'] }
    );
  }

  async update(scrapId: number, updateScrapDto: UpdateScrapDto): Promise<Scrap | null> {
    const scrap = await this.scrapRepository.findOne({ scrapId });
    if (!scrap) {
      return null;
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
        { userComment: { $ilike: `%${query}%` } }
      ]
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
    paginationOptions: PaginationOptions = {}
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
          { url: { $ilike: `%${searchTerm}%` } }
        ]
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
          name: { $in: searchOptions.tags } 
        } 
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
      limit
    };
  }

  /**
   * 태그 기반 필터링
   */
  async findByTags(
    tagNames: string[], 
    userId?: number, 
    matchAll: boolean = false
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
}
