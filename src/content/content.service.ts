import { Injectable } from '@nestjs/common';
import {
  EntityManager,
  EntityRepository,
  QueryOrder,
} from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Scrap } from '../scraps/entities/scrap.entity';
import { Article } from '../articles/entities/article.entity';
import {
  UnifiedContentQueryDto,
  ContentType,
  SortByField,
} from '../api/content/dto/unified-content-query.dto';
import {
  UnifiedContentResponseDto,
  UnifiedContentItemDto,
} from '../api/content/dto/unified-content-response.dto';

@Injectable()
export class ContentService {
  // Safety limit to prevent OOM when fetching both content types
  private readonly MAX_IN_MEMORY_ITEMS = 1000;

  constructor(
    private readonly em: EntityManager,
    @InjectRepository(Scrap)
    private readonly scrapRepository: EntityRepository<Scrap>,
    @InjectRepository(Article)
    private readonly articleRepository: EntityRepository<Article>,
  ) {}

  /**
   * Get unified content (scraps and articles) with pagination, filtering, and search
   */
  async getUnifiedContent(
    userId: number,
    query: UnifiedContentQueryDto,
  ): Promise<UnifiedContentResponseDto> {
    const { type, folderId, scrapType, search, tags } = query;

    // Ensure defaults for required pagination fields
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? SortByField.CREATED_AT;
    const sortOrder = query.sortOrder ?? 'DESC';

    // Determine which content types to fetch
    const includeScraps =
      type === ContentType.ALL || type === ContentType.SCRAP;
    const includeArticles =
      type === ContentType.ALL || type === ContentType.ARTICLE;

    let scraps: Scrap[] = [];
    let scrapTotal = 0;
    let articles: Article[] = [];
    let articleTotal = 0;

    // Fetch scraps if needed
    if (includeScraps) {
      const scrapResult = await this.fetchScraps(userId, {
        folderId,
        scrapType,
        sortBy,
        sortOrder,
        search,
        tags,
        page,
        limit,
        includeArticles, // If both types, we need to merge and paginate later
      });
      scraps = scrapResult.items;
      scrapTotal = scrapResult.total;
    }

    // Fetch articles if needed
    if (includeArticles) {
      const articleResult = await this.fetchArticles(userId, {
        folderId,
        sortBy,
        sortOrder,
        search,
        tags,
        page,
        limit,
        includeScraps, // If both types, we need to merge and paginate later
      });
      articles = articleResult.items;
      articleTotal = articleResult.total;
    }

    // If fetching both types, we need to merge, sort, and paginate
    if (type === ContentType.ALL) {
      return this.mergeAndPaginateContent(
        scraps,
        articles,
        scrapTotal,
        articleTotal,
        page,
        limit,
        sortBy,
        sortOrder,
      );
    }

    // If fetching single type, convert to DTOs
    const items: UnifiedContentItemDto[] = [];
    let total = 0;

    if (includeScraps && !includeArticles) {
      items.push(...scraps.map((scrap) => this.scrapToDto(scrap)));
      total = scrapTotal;
    } else if (includeArticles && !includeScraps) {
      items.push(...articles.map((article) => this.articleToDto(article)));
      total = articleTotal;
    }

    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    return {
      items,
      total,
      page,
      limit,
      hasMore,
      totalPages,
    };
  }

  /**
   * Fetch scraps with filters
   */
  private async fetchScraps(
    userId: number,
    options: {
      folderId?: string | null;
      scrapType?: string;
      sortBy: SortByField;
      sortOrder: string;
      search?: string;
      tags?: string[];
      page: number;
      limit: number;
      includeArticles?: boolean;
    },
  ): Promise<{ items: Scrap[]; total: number }> {
    const {
      folderId,
      scrapType,
      sortBy,
      sortOrder,
      search,
      tags,
      page,
      limit,
      includeArticles,
    } = options;

    const where: any = {
      user: { userId },
      isDeleted: false,
    };

    // Folder filter
    if (folderId !== undefined) {
      if (folderId === null || folderId === 'null') {
        where.folder = null;
      } else {
        where.folder = { folderId };
      }
    }

    // Scrap type filter (webclip vs upload)
    if (scrapType) {
      if (scrapType === 'webclip') {
        where.type = 'webclip';
      } else if (scrapType === 'upload') {
        // Upload types: pdf, image, video, audio, upload
        where.type = { $in: ['pdf', 'image', 'video', 'audio', 'upload'] };
      }
    }

    // Search filter (title or content)
    if (search) {
      where.$or = [
        { title: { $ilike: `%${search}%` } },
        { content: { $ilike: `%${search}%` } },
      ];
    }

    // Tag filter (scraps with any of the specified tags)
    if (tags && tags.length > 0) {
      where.tags = { name: { $in: tags } };
    }

    // Get total count
    const total = await this.scrapRepository.count(where);

    // Set hard limit when fetching both types to prevent memory issues
    // When includeArticles=true, we need more items for proper sorting, but not unlimited
    const offset = includeArticles ? 0 : (page - 1) * limit;
    const fetchLimit = includeArticles
      ? Math.min(this.MAX_IN_MEMORY_ITEMS, limit * 2) // Fetch 2x limit for better merge results
      : limit;

    // Warn if we're hitting the safety limit
    if (includeArticles && total > this.MAX_IN_MEMORY_ITEMS) {
      console.warn(
        `[ContentService] Scrap total (${total}) exceeds MAX_IN_MEMORY_ITEMS (${this.MAX_IN_MEMORY_ITEMS}). ` +
          `Results may be incomplete for unified content view. Consider adding folder filters.`,
      );
    }

    // Determine sort field and order
    const orderBy = this.getSortField(sortBy, 'scrap');
    const order = sortOrder === 'ASC' ? QueryOrder.ASC : QueryOrder.DESC;

    // Fetch scraps with tags populated
    const items = await this.scrapRepository.find(where, {
      populate: ['tags'],
      orderBy: { [orderBy]: order },
      offset,
      limit: fetchLimit,
    });

    return { items, total };
  }

  /**
   * Fetch articles with filters
   */
  private async fetchArticles(
    userId: number,
    options: {
      folderId?: string | null;
      sortBy: SortByField;
      sortOrder: string;
      search?: string;
      tags?: string[];
      page: number;
      limit: number;
      includeScraps?: boolean;
    },
  ): Promise<{ items: Article[]; total: number }> {
    const { folderId, sortBy, sortOrder, search, tags, page, limit, includeScraps } =
      options;

    const where: any = {
      user: { userId },
      isDeleted: false,
    };

    // Folder filter
    if (folderId !== undefined) {
      if (folderId === null || folderId === 'null') {
        where.folder = null;
      } else {
        where.folder = { folderId };
      }
    }

    // Search filter (title or content from latest archive)
    if (search) {
      // Note: Searching article content requires joining with archives
      // For simplicity, we'll search in topic and keyInsight
      where.$or = [
        { topic: { $ilike: `%${search}%` } },
        { keyInsight: { $ilike: `%${search}%` } },
      ];
    }

    // Tag filter (OR logic - match any of the provided tags)
    if (tags && tags.length > 0) {
      where.tags = {
        name: { $in: tags },
      };
    }

    // Get total count
    const total = await this.articleRepository.count(where);

    // Set hard limit when fetching both types to prevent memory issues
    // When includeScraps=true, we need more items for proper sorting, but not unlimited
    const offset = includeScraps ? 0 : (page - 1) * limit;
    const fetchLimit = includeScraps
      ? Math.min(this.MAX_IN_MEMORY_ITEMS, limit * 2) // Fetch 2x limit for better merge results
      : limit;

    // Warn if we're hitting the safety limit
    if (includeScraps && total > this.MAX_IN_MEMORY_ITEMS) {
      console.warn(
        `[ContentService] Article total (${total}) exceeds MAX_IN_MEMORY_ITEMS (${this.MAX_IN_MEMORY_ITEMS}). ` +
          `Results may be incomplete for unified content view. Consider adding folder filters.`,
      );
    }

    // Determine sort field and order
    const orderBy = this.getSortField(sortBy, 'article');
    const order = sortOrder === 'ASC' ? QueryOrder.ASC : QueryOrder.DESC;

    // Fetch articles with archives and tags populated
    const items = await this.articleRepository.find(where, {
      populate: ['archives', 'tags'],
      orderBy: { [orderBy]: order },
      offset,
      limit: fetchLimit,
    });

    return { items, total };
  }

  /**
   * Merge scraps and articles, sort, and paginate
   */
  private mergeAndPaginateContent(
    scraps: Scrap[],
    articles: Article[],
    scrapTotal: number,
    articleTotal: number,
    page: number,
    limit: number,
    sortBy: SortByField,
    sortOrder: string,
  ): UnifiedContentResponseDto {
    // Convert to DTOs
    const scrapDtos = scraps.map((scrap) => this.scrapToDto(scrap));
    const articleDtos = articles.map((article) => this.articleToDto(article));

    // Merge all items
    const allItems = [...scrapDtos, ...articleDtos];

    // Sort by the specified field
    allItems.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortBy === SortByField.CREATED_AT) {
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
      } else if (sortBy === SortByField.UPDATED_AT) {
        aValue = new Date(a.updatedAt).getTime();
        bValue = new Date(b.updatedAt).getTime();
      } else if (sortBy === SortByField.TITLE) {
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
      }

      if (sortOrder === 'ASC') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    // Paginate
    const total = scrapTotal + articleTotal;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const items = allItems.slice(startIndex, endIndex);
    const hasMore = page < totalPages;

    return {
      items,
      total,
      page,
      limit,
      hasMore,
      totalPages,
    };
  }

  /**
   * Convert Scrap entity to UnifiedContentItemDto
   */
  private scrapToDto(scrap: Scrap): UnifiedContentItemDto {
    // Get content preview (first 200 characters)
    let contentPreview = scrap.content || '';
    if (contentPreview.length > 200) {
      contentPreview = contentPreview.substring(0, 200) + '...';
    }

    return {
      id: scrap.scrapId.toString(),
      type: 'scrap',
      title: scrap.title,
      contentPreview,
      createdAt: scrap.createdAt,
      updatedAt: scrap.updatedAt,
      folderId: scrap.folder?.folderId,
      url: scrap.url,
      scrapType: scrap.type as any,
      heroImageUrl: scrap.heroImageUrl,
      faviconUrl: scrap.webpage?.site?.favicon_url,
      tags: scrap.tags?.getItems().map((tag) => ({
        tagId: tag.tagId,
        name: tag.name,
      })),
    };
  }

  /**
   * Convert Article entity to UnifiedContentItemDto
   */
  private articleToDto(article: Article): UnifiedContentItemDto {
    // Get content preview from latest archive
    const latestContent = article.getLatestContent() || '';
    let contentPreview = latestContent;

    // If content is TipTap JSON, extract text
    if (contentPreview.trim().startsWith('{')) {
      try {
        const json = JSON.parse(contentPreview);
        // Extract plain text from TipTap JSON (simplified)
        contentPreview = this.extractTextFromTipTap(json);
      } catch {
        // If parsing fails, use as-is
      }
    }

    // Limit to 200 characters
    if (contentPreview.length > 200) {
      contentPreview = contentPreview.substring(0, 200) + '...';
    }

    return {
      id: article.articleId.toString(),
      type: 'article',
      title: article.getLatestTitle() || 'Untitled',
      contentPreview,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      folderId: article.folder?.folderId,
      topic: article.topic,
      keyInsight: article.keyInsight,
      generationStatus: article.generationStatus,
      tags: article.tags?.getItems().map((tag) => ({
        tagId: tag.tagId,
        name: tag.name,
      })),
    };
  }

  /**
   * Extract plain text from TipTap JSON (simplified)
   */
  private extractTextFromTipTap(json: any): string {
    if (!json || typeof json !== 'object') return '';

    let text = '';

    if (json.text) {
      text += json.text;
    }

    if (json.content && Array.isArray(json.content)) {
      for (const node of json.content) {
        text += this.extractTextFromTipTap(node) + ' ';
      }
    }

    return text.trim();
  }

  /**
   * Get database field name for sorting
   */
  private getSortField(
    sortBy: SortByField,
    entityType: 'scrap' | 'article',
  ): string {
    if (sortBy === SortByField.CREATED_AT) {
      return 'createdAt';
    } else if (sortBy === SortByField.UPDATED_AT) {
      return 'updatedAt';
    } else if (sortBy === SortByField.TITLE) {
      return 'title';
    }
    return 'createdAt'; // Default
  }
}
