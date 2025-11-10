import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateScrapDto } from '../api/scraps/dto/create-scrap.dto';
import { UpdateScrapDto } from '../api/scraps/dto/update-scrap.dto';
import {
  ScrapResponseDto,
  ScrapSummaryDto,
} from '../api/scraps/dto/scrap-response.dto';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { Scrap } from './entities/scrap.entity';
import { InjectRepository } from '@mikro-orm/nestjs';
import { User } from '../users/entities/user.entity';
import { Article } from '../articles/entities/article.entity';
import { ArticleScrap } from '../articles/entities/article-scrap.entity';
import {
  UserIdentifierLike,
  buildUserFilterFromInput,
  normalizeUserIdentifier,
} from '../users/utils/user-identifier.util';
import {
  ScrapIdentifier,
  ScrapIdentifierLike,
  buildScrapFilterFromInput,
  ensureScrapIdentifier,
  isUuid,
} from './utils/scrap-identifier.util';
// Analytics tracking migrated to extension client (PostHog).

export interface SearchOptions {
  query?: string;
  userId?: UserIdentifierLike;
  articleId?: string;
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
    @InjectRepository(ArticleScrap)
    private readonly articleScrapRepository: EntityRepository<ArticleScrap>,
  ) {}

  async create(
    createScrapDto: CreateScrapDto,
    userId: UserIdentifierLike,
    articleId?: string,
  ): Promise<ScrapSummaryDto> {
    const user = await this.userRepository.findOne(
      buildUserFilterFromInput(userId),
    );
    if (!user) {
      throw new Error('User not found');
    }

    // Removed first-scrap existence check (no longer needed for activation event)

    const article = articleId
      ? await this.articleRepository.findOne({ articleId, isDeleted: false })
      : null;
    if (articleId && !article) {
      throw new Error('Article not found');
    }

    const scrap = new Scrap();
    scrap.url = createScrapDto.url;
    scrap.title = createScrapDto.title;
    scrap.content = createScrapDto.content;
    scrap.htmlContent = createScrapDto.htmlContent || '';
    scrap.description = createScrapDto.description;
    scrap.userComment = createScrapDto.userComment;
    scrap.user = user;

    // Store new metadata fields
    if (createScrapDto.webpage) {
      scrap.webpage = createScrapDto.webpage;
    }

    if (createScrapDto.content_info) {
      scrap.contentInfo = createScrapDto.content_info;
    }

    if (createScrapDto.hero_image_url) {
      scrap.heroImageUrl = createScrapDto.hero_image_url;
    }

    if (createScrapDto.published_at) {
      scrap.publishedAt = new Date(createScrapDto.published_at);
    }

    if (createScrapDto.authors) {
      scrap.authors = createScrapDto.authors;
    }

    scrap.type = createScrapDto.type || 'webclip';
    scrap.from = createScrapDto.from || 'extension';

    // Note: article relationship removed - use ArticleScrap junction table instead
    // if (article) {
    //   scrap.article = article;
    // }

    await this.em.persistAndFlush(scrap);

    // Event tracking moved to client
    // Return DTO instead of mutated entity
    return this.toScrapSummaryDto(scrap);
  }

  async findAll(userId?: UserIdentifierLike): Promise<Scrap[]> {
    const query: any = { isDeleted: false };

    if (normalizeUserIdentifier(userId) !== undefined) {
      query.user = buildUserFilterFromInput(userId as UserIdentifierLike);
      query.filePath = null;
    } else {
      query.mimeType = null;
    }

    return await this.scrapRepository.find(query, {
      populate: ['tags'],
      filters: { isDeleted: false },
    });
  }

  async findOne(
    scrapId: ScrapIdentifierLike,
    userId?: UserIdentifierLike,
  ): Promise<ScrapResponseDto | null> {
    const query: any = {
      ...buildScrapFilterFromInput(scrapId),
      isDeleted: false,
    };

    // Add user authorization if userId is provided
    if (normalizeUserIdentifier(userId) !== undefined) {
      query.user = buildUserFilterFromInput(userId as UserIdentifierLike);
    }

    const scrap = await this.scrapRepository.findOne(query, {
      populate: ['tags'],
      filters: { isDeleted: false },
    });

    return scrap ? this.toScrapResponseDto(scrap) : null;
  }

  /**
   * Find multiple scraps by their IDs in a single query
   * @param scrapIds Array of scrap IDs to fetch
   * @param userId Optional user ID for authorization
   * @returns Array of ScrapResponseDto for found scraps
   */
  async findMany(
    scrapIds: ScrapIdentifier[],
    userId?: UserIdentifierLike,
  ): Promise<ScrapResponseDto[]> {
    if (!scrapIds || scrapIds.length === 0) {
      return [];
    }

    // Separate UUIDs and legacy IDs
    const uuids = scrapIds.filter(
      (id) => typeof id === 'string' && isUuid(id),
    );
    const legacyIds = scrapIds.filter((id) => typeof id === 'number');

    // Build query with OR condition for both UUID and legacy IDs
    const idConditions: any[] = [];
    if (uuids.length > 0) {
      idConditions.push({ scrapId: { $in: uuids } });
    }
    if (legacyIds.length > 0) {
      idConditions.push({ legacyScrapId: { $in: legacyIds } });
    }

    if (idConditions.length === 0) {
      return [];
    }

    const query: any = {
      $or: idConditions,
      isDeleted: false,
    };

    // Add user authorization if userId is provided
    if (normalizeUserIdentifier(userId) !== undefined) {
      query.user = buildUserFilterFromInput(userId as UserIdentifierLike);
    }

    const scraps = await this.scrapRepository.find(query, {
      populate: ['tags'],
      filters: { isDeleted: false },
    });

    // Convert all found scraps to DTOs with truncated content for list view
    const scrapMap = new Map<string, ScrapResponseDto>();
    scraps.forEach((scrap) => {
      const dto = this.toScrapResponseDto(scrap);

      // Truncate content fields to 100 characters for list view
      if (dto.content && dto.content.length > 100) {
        dto.content = dto.content.substring(0, 100) + '...';
      }
      if (dto.htmlContent && dto.htmlContent.length > 100) {
        dto.htmlContent = dto.htmlContent.substring(0, 100) + '...';
      }
      if (dto.contentInfo) {
        if (dto.contentInfo.raw && dto.contentInfo.raw.length > 100) {
          dto.contentInfo.raw = dto.contentInfo.raw.substring(0, 100) + '...';
        }
        if (dto.contentInfo.plain && dto.contentInfo.plain.length > 100) {
          dto.contentInfo.plain =
            dto.contentInfo.plain.substring(0, 100) + '...';
        }
        if (dto.contentInfo.text && dto.contentInfo.text.length > 100) {
          dto.contentInfo.text = dto.contentInfo.text.substring(0, 100) + '...';
        }
      }

      scrapMap.set(scrap.scrapId, dto);
    });

    // Return scraps in the same order as requested IDs
    return scrapIds
      .map((id) => scrapMap.get(String(id)))
      .filter((scrap): scrap is ScrapResponseDto => scrap !== undefined);
  }

  async findByUser(
    userId: UserIdentifierLike,
    sortBy?: 'created_at' | 'updated_at' | 'title',
    sortOrder?: 'ASC' | 'DESC',
  ): Promise<ScrapSummaryDto[]> {
    const query = {
      user: buildUserFilterFromInput(userId),
      isDeleted: false,
      mimeType: null,
    };
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

    const scraps = await this.scrapRepository.find(query, {
      populate: ['tags'],
      orderBy: orderBy,
      filters: { isDeleted: false },
    });

    // Return DTOs with content preview instead of mutating entities
    return scraps.map((scrap) => this.toScrapSummaryDto(scrap));
  }

  /**
   * V2: Find all scraps by user with pagination (webclip + upload unified)
   */
  async findByUserV2(
    userId: UserIdentifierLike,
    sortBy?: 'created_at' | 'updated_at' | 'title',
    sortOrder?: 'ASC' | 'DESC',
    type?: string, // 'webclip', 'upload', or undefined for all
    page: number = 1,
    limit: number = 20,
  ): Promise<{ scraps: ScrapSummaryDto[]; total: number; hasMore: boolean }> {
    const query: any = {
      user: buildUserFilterFromInput(userId),
      isDeleted: false,
    };

    // Filter by type if specified
    if (type === 'webclip') {
      query.mimeType = null;
    } else if (type === 'upload') {
      query.mimeType = { $ne: null };
    }
    // If type is undefined, return all scraps (both webclip and upload)

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

    const offset = (page - 1) * limit;

    const [scraps, total] = await this.scrapRepository.findAndCount(query, {
      populate: ['tags'],
      orderBy: orderBy,
      filters: { isDeleted: false },
      limit,
      offset,
    });

    const hasMore = offset + scraps.length < total;

    return {
      scraps: scraps.map((scrap) => this.toScrapSummaryDto(scrap)),
      total,
      hasMore,
    };
  }

  async findByArticle(articleId: string): Promise<Scrap[]> {
    // Find all ArticleScrap junction records for this article
    const articleScraps = await this.articleScrapRepository.find(
      { article: { articleId } },
      { populate: ['scrap', 'scrap.tags'] },
    );

    // Extract and return the scraps (filter out deleted ones)
    return articleScraps
      .map((as) => as.scrap)
      .filter((scrap) => !scrap.isDeleted);
  }

  async update(
    scrapId: ScrapIdentifierLike,
    updateScrapDto: UpdateScrapDto,
    userId?: UserIdentifierLike,
  ): Promise<Scrap | null> {
    const query: any = {
      ...buildScrapFilterFromInput(scrapId),
      isDeleted: false,
    };

    // Add user authorization if userId is provided
    if (normalizeUserIdentifier(userId) !== undefined) {
      query.user = buildUserFilterFromInput(userId as UserIdentifierLike);
    }

    const scrap = await this.scrapRepository.findOne(query);
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
    await this.em.persistAndFlush(scrap);
    return scrap;
  }

  async remove(
    scrapId: ScrapIdentifierLike,
    userId?: UserIdentifierLike,
  ): Promise<void> {
    const query: any = buildScrapFilterFromInput(scrapId);

    // Add user authorization if userId is provided
    if (normalizeUserIdentifier(userId) !== undefined) {
      query.user = buildUserFilterFromInput(userId as UserIdentifierLike);
    }

    const scrap = await this.scrapRepository.findOne(query, {
      populate: ['tags'],
      filters: { isDeleted: false },
    });

    if (scrap) {
      if (scrap.tags.length > 0) {
        for (const tag of scrap.tags) {
          this.em.removeAndFlush(tag);
        }
      }
      scrap.isDeleted = true;
      await this.em.persistAndFlush(scrap);
    }
  }

  async search(query: string, userId?: UserIdentifierLike): Promise<Scrap[]> {
    const qb = this.em.createQueryBuilder(Scrap, 's');

    qb.where({
      $or: [
        { title: { $ilike: `%${query}%` } },
        { content: { $ilike: `%${query}%` } },
        { userComment: { $ilike: `%${query}%` } },
      ],
      isDeleted: false,
    });

    if (normalizeUserIdentifier(userId) !== undefined) {
      qb.andWhere({
        user: buildUserFilterFromInput(userId as UserIdentifierLike),
        isDeleted: false,
      });
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
          { description: { $ilike: `%${searchTerm}%` } },
          { userComment: { $ilike: `%${searchTerm}%` } },
          { url: { $ilike: `%${searchTerm}%` } },
        ],
        isDeleted: false,
      });
    }

    // 사용자 필터
    if (normalizeUserIdentifier(searchOptions.userId) !== undefined) {
      qb.andWhere({
        user: buildUserFilterFromInput(
          searchOptions.userId as UserIdentifierLike,
        ),
        isDeleted: false,
      });
    }

    // 기사 필터
    if (searchOptions.articleId) {
      qb.andWhere({
        article: { articleId: searchOptions.articleId },
        isDeleted: false,
      });
    }

    // 태그 기반 필터링
    if (searchOptions.tags && searchOptions.tags.length > 0) {
      qb.andWhere({
        tags: {
          name: { $in: searchOptions.tags },
        },
        isDeleted: false,
      });
    }

    // 날짜 범위 필터
    if (searchOptions.dateFrom) {
      qb.andWhere({
        createdAt: { $gte: searchOptions.dateFrom },
        isDeleted: false,
      });
    }
    if (searchOptions.dateTo) {
      qb.andWhere({
        createdAt: { $lte: searchOptions.dateTo },
        isDeleted: false,
      });
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
    userId?: UserIdentifierLike,
    matchAll: boolean = false,
  ): Promise<Scrap[]> {
    const qb = this.em.createQueryBuilder(Scrap, 's');

    qb.leftJoinAndSelect('s.user', 'u')
      .leftJoinAndSelect('s.article', 'a')
      .leftJoinAndSelect('s.tags', 't')
      .where({ isDeleted: false });

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
      qb.andWhere({ user: { userId }, isDeleted: false });
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
   * 추출된 텍스트를 간단히 요약합니다
   * TODO: 필요시 FastAPI 서비스를 호출하여 AI 요약 기능 구현
   */
  private async generateAiSummary(text: string): Promise<string> {
    if (!text || text.length < 50) {
      return text; // 짧은 텍스트는 그대로 반환
    }

    try {
      // 현재는 단순 텍스트 트리밍으로 대체
      // 향후 필요시 FastAPI AI 요약 서비스 호출 가능
      return text.length > 500 ? text.substring(0, 500) + '...' : text;
    } catch (error) {
      console.error('요약 생성 실패:', error);
      // 실패 시 원본 텍스트의 일부만 반환
      return text.length > 500 ? text.substring(0, 500) + '...' : text;
    }
  }

  /**
   * Convert Scrap entity to ScrapSummaryDto with content preview
   */
  private toScrapSummaryDto(scrap: Scrap): ScrapSummaryDto {
    return {
      scrapId: scrap.scrapId,
      legacyScrapId: scrap.legacyScrapId,
      url: scrap.url,
      title: scrap.title,
      contentPreview:
        scrap.content && scrap.content.length > 100
          ? scrap.content.substring(0, 100) + '...'
          : scrap.content,
      description: scrap.description,
      userComment: scrap.userComment,
      fileName: scrap.fileName,
      mimeType: scrap.mimeType,
      isDeleted: scrap.isDeleted,
      createdAt: scrap.createdAt,
      updatedAt: scrap.updatedAt,
      articleId: undefined, // Removed: use ArticleScrap junction to find related articles
      tags: scrap.tags?.getItems().map((tag) => ({
        tagId: tag.tagId,
        name: tag.name,
      })),
      heroImageUrl: scrap.heroImageUrl,
      type: scrap.type,
    };
  }

  /**
   * Convert Scrap entity to ScrapResponseDto with full content
   */
  private toScrapResponseDto(scrap: Scrap): ScrapResponseDto {
    return {
      scrapId: scrap.scrapId,
      legacyScrapId: scrap.legacyScrapId,
      url: scrap.url,
      title: scrap.title,
      content: scrap.content,
      htmlContent: scrap.htmlContent,
      description: scrap.description,
      userComment: scrap.userComment,
      fileName: scrap.fileName,
      filePath: scrap.filePath,
      mimeType: scrap.mimeType,
      fileSize: scrap.fileSize,
      aiContent: scrap.aiContent,
      isDeleted: scrap.isDeleted,
      createdAt: scrap.createdAt,
      updatedAt: scrap.updatedAt,
      articleId: undefined, // Removed: use ArticleScrap junction to find related articles
      tags: scrap.tags?.getItems().map((tag) => ({
        tagId: tag.tagId,
        name: tag.name,
      })),
      // New metadata fields
      contentInfo: scrap.contentInfo,
      // Only include favicon from webpage to reduce payload size
      webpage: scrap.webpage
        ? {
            site: {
              favicon_url: scrap.webpage.site?.favicon_url,
            },
          }
        : undefined,
      heroImageUrl: scrap.heroImageUrl,
      publishedAt: scrap.publishedAt,
      authors: scrap.authors,
      type: scrap.type,
      from: scrap.from,
    };
  }

  /**
   * Resolve a scrap identifier (UUID or legacy integer ID) to its canonical UUID
   * @param identifier UUID string or legacy integer ID
   * @param options Configuration options
   * @returns Canonical UUID string or null if not found
   */
  async resolveCanonicalScrapId(
    identifier: ScrapIdentifierLike,
    { throwOnNotFound = true }: { throwOnNotFound?: boolean } = {},
  ): Promise<string | null> {
    const normalized = ensureScrapIdentifier(identifier);

    // If it's already a UUID, return it
    if (typeof normalized === 'string' && isUuid(normalized)) {
      return normalized.toLowerCase();
    }

    // Look up by legacy ID
    const scrap = await this.scrapRepository.findOne(
      buildScrapFilterFromInput(normalized),
    );

    if (!scrap) {
      if (throwOnNotFound) {
        throw new NotFoundException('Scrap not found');
      }
      return null;
    }

    return scrap.scrapId;
  }
}
