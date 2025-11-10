import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Version,
  Query,
  HttpException,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ScrapsService,
  SearchOptions,
  PaginationOptions,
} from '../../scraps/scraps.service';
import { TagsService } from '../../tags/tags.service';
import { CreateScrapDto } from './dto/create-scrap.dto';
import { UpdateScrapDto } from './dto/update-scrap.dto';
import { ScrapResponseDto, ScrapSummaryDto } from './dto/scrap-response.dto';
import { CreateTagDto } from '../tags/dto/create-tag.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Scrap } from 'src/scraps/entities/scrap.entity';
import { ScrapIdParamPipe } from '../../scraps/pipes/scrap-id.pipe';
import { TagIdParamPipe } from '../../tags/pipes/tag-id.pipe';

@UseGuards(JwtAuthGuard)
@Controller('scraps')
export class ScrapsController {
  constructor(
    private readonly scrapsService: ScrapsService,
    private readonly tagsService: TagsService,
  ) {}

  /**
   * POST /api/v1/scraps - 스크랩 생성 (Article 연결)
   */
  @Version('1')
  @Post()
  async create(
    @Body() createScrapDto: CreateScrapDto,
    @Request() req: any,
  ): Promise<ScrapSummaryDto> {
    try {
      const userId = req.user.id; // JWT에서 사용자 ID 추출
      const { articleId, ...scrapData } = createScrapDto;

      return await this.scrapsService.create(scrapData, userId, articleId);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /api/v1/scraps - 현재 사용자의 스크랩 목록 조회
   */
  @Version('1')
  @Get()
  async findAll(
    @Request() req: any,
    @Query('articleId') articleId?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: 'created_at' | 'updated_at' | 'title',
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ): Promise<ScrapSummaryDto[] | Scrap[]> {
    try {
      const userId = req.user.id; // JWT에서 사용자 ID 추출

      if (search) {
        return await this.scrapsService.search(search, userId);
      }

      if (articleId) {
        return await this.scrapsService.findByArticle(articleId);
      }

      // 현재 사용자의 스크랩만 조회
      return await this.scrapsService.findByUser(userId, sortBy, sortOrder);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/v1/scraps/search/advanced - 고급 검색 및 필터링
   */
  @Version('1')
  @Get('search/advanced')
  async advancedSearch(
    @Request() req: any,
    @Query('query') query?: string,
    @Query('articleId') articleId?: string,
    @Query('tags') tags?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('sortBy') sortBy?: 'created_at' | 'updated_at' | 'title',
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    try {
      const userId = req.user.id; // JWT에서 사용자 ID 추출

      const searchOptions: SearchOptions = {
        query,
        userId, // JWT에서 추출한 사용자 ID 사용
        articleId,
        tags: tags ? tags.split(',').map((tag) => tag.trim()) : undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        sortBy: sortBy || 'created_at',
        sortOrder: sortOrder || 'DESC',
      };

      const paginationOptions: PaginationOptions = {
        page: page || 1,
        limit: limit || 20,
      };

      return await this.scrapsService.advancedSearch(
        searchOptions,
        paginationOptions,
      );
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /api/v1/scraps/search/tags - 태그 기반 필터링
   */
  @Version('1')
  @Get('search/tags')
  async findByTags(
    @Request() req: any,
    @Query('tags') tags: string,
    @Query('matchAll') matchAll?: boolean,
  ) {
    try {
      const userId = req.user.id; // JWT에서 사용자 ID 추출

      if (!tags || tags.trim().length === 0) {
        throw new HttpException(
          'Tags parameter is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const tagNames = tags.split(',').map((tag) => tag.trim());
      return await this.scrapsService.findByTags(
        tagNames,
        userId,
        matchAll || false,
      );
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/v1/scraps/:scrapId - 스크랩 상세 조회
   */
  @Version('1')
  @Get(':scrapId')
  async findOne(
    @Param('scrapId', ScrapIdParamPipe) scrapId: string,
    @Request() req: any,
  ): Promise<ScrapResponseDto> {
    try {
      const userId = req.user.id; // JWT에서 사용자 ID 추출
      const scrap = await this.scrapsService.findOne(scrapId, userId);
      if (!scrap) {
        throw new HttpException('Scrap not found', HttpStatus.NOT_FOUND);
      }
      return scrap;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * PUT /api/v1/scraps/:key - 스크랩 수정
   */
  @Version('1')
  @Put(':scrapId')
  async update(
    @Param('scrapId', ScrapIdParamPipe) scrapId: string,
    @Body() updateScrapDto: UpdateScrapDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id; // JWT에서 사용자 ID 추출
      await this.validateScrapExists(scrapId, userId);
      return await this.scrapsService.update(scrapId, updateScrapDto, userId);
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * DELETE /api/v1/scraps/:key - 스크랩 삭제
   */
  @Version('1')
  @Delete(':scrapId')
  async remove(
    @Param('scrapId', ScrapIdParamPipe) scrapId: string,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id; // JWT에서 사용자 ID 추출
      await this.scrapsService.remove(scrapId, userId);
      return { message: 'Scrap deleted successfully' };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/v1/scraps/article/:articleId - 특정 기사의 스크랩 목록
   */
  @Version('1')
  @Get('article/:articleId')
  async findByArticle(@Param('articleId') articleId: string) {
    try {
      return await this.scrapsService.findByArticle(articleId);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ========== 스크랩-태그 관계 관리 API ==========

  /**
   * POST /api/v1/scraps/:scrapId/tags - 스크랩에 태그 추가
   */
  @Version('1')
  @Post(':scrapId/tags')
  async addTagToScrap(
    @Request() req: any,
    @Param('scrapId', ScrapIdParamPipe) scrapId: string,
    @Body() createTagDto: CreateTagDto,
  ) {
    try {
      const userId = req.user.id; // JWT에서 사용자 ID 추출

      // 스크랩 존재 및 권한 확인
      await this.validateScrapExists(scrapId, userId);

      // 태그 생성 (scrapId와 함께)
      const tagData = { ...createTagDto, scrapId };
      return await this.tagsService.create(tagData, userId, scrapId);
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  private async validateScrapExists(scrapId: string, userId?: string) {
    const scrap = await this.scrapsService.findOne(scrapId, userId);
    if (!scrap) {
      throw new HttpException('Scrap not found', HttpStatus.NOT_FOUND);
    }
  }

  /**
   * GET /api/v1/scraps/:scrapKey/tags - 스크랩의 태그 목록 조회
   */
  @Version('1')
  @Get(':scrapId/tags')
  async getScrapTags(
    @Param('scrapId', ScrapIdParamPipe) scrapId: string,
    @Request() req: any,
  ) {
    try {
      const userId = req.user.id; // JWT에서 사용자 ID 추출
      // 스크랩 존재 및 권한 확인
      await this.validateScrapExists(scrapId, userId);

      return await this.tagsService.findByScrap(scrapId);
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * DELETE /api/v1/scraps/:scrapId/tags/:tagId - 스크랩에서 태그 제거
   */
  @Version('1')
  @Delete(':scrapId/tags/:tagId')
  async removeTagFromScrap(
    @Request() req: any,
    @Param('scrapId', ScrapIdParamPipe) scrapId: string,
    @Param('tagId', TagIdParamPipe) tagId: string,
  ) {
    try {
      const userId = req.user.id; // JWT에서 사용자 ID 추출

      // 스크랩 존재 및 권한 확인
      const scrap = await this.scrapsService.findOne(scrapId, userId);
      if (!scrap) {
        throw new HttpException('Scrap not found', HttpStatus.NOT_FOUND);
      }

      // 태그 존재 및 권한 확인 후 삭제
      await this.tagsService.remove(tagId);
      return { message: 'Tag removed from scrap successfully' };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ========== VERSION 2 API - Enhanced Metadata Support ==========

  /**
   * POST /api/v2/scraps - 스크랩 생성 (향상된 메타데이터 포함)
   */
  @Version('2')
  @Post()
  async createV2(
    @Body() createScrapDto: CreateScrapDto,
    @Request() req: any,
  ): Promise<ScrapResponseDto> {
    try {
      const userId = req.user.id;
      const { articleId, tags, ...scrapData } = createScrapDto;

      // Create scrap with enhanced metadata
      const scrapSummary = await this.scrapsService.create(
        scrapData,
        userId,
        articleId,
      );

      // Add tags if provided
      if (tags && tags.length > 0) {
        for (const tagName of tags) {
          await this.tagsService.create(
            { name: tagName, scrapId: scrapSummary.scrapId },
            userId,
            scrapSummary.scrapId,
          );
        }
      }

      // Return full scrap with all metadata
      const fullScrap = await this.scrapsService.findOne(scrapSummary.scrapId);
      return fullScrap!;
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /api/v2/scraps - 현재 사용자의 스크랩 목록 조회 (향상된 메타데이터 포함)
   */
  @Version('2')
  @Get()
  async findAllV2(
    @Request() req: any,
    @Query('articleId') articleId?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: 'created_at' | 'updated_at' | 'title',
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ): Promise<ScrapResponseDto[]> {
    try {
      const userId = req.user.id;

      if (search) {
        const scraps = await this.scrapsService.search(search, userId);
        return this.enrichScrapsWithMetadata(scraps, userId);
      }

      if (articleId) {
        const scraps = await this.scrapsService.findByArticle(articleId);
        return this.enrichScrapsWithMetadata(scraps, userId);
      }

      // Get user's scraps with enhanced metadata
      const scraps = await this.scrapsService.findByUser(
        userId,
        sortBy,
        sortOrder,
      );

      // Batch fetch full response DTOs with all metadata fields
      const scrapIds = scraps.map((scrap) => scrap.scrapId);
      return await this.scrapsService.findMany(scrapIds, userId);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/v2/scraps/:scrapId - 스크랩 상세 조회 (향상된 메타데이터 포함)
   */
  @Version('2')
  @Get(':scrapId')
  async findOneV2(
    @Param('scrapId', ScrapIdParamPipe) scrapId: string,
    @Request() req: any,
  ): Promise<ScrapResponseDto> {
    try {
      const userId = req.user.id; // JWT에서 사용자 ID 추출
      const scrap = await this.scrapsService.findOne(scrapId, userId);
      if (!scrap) {
        throw new HttpException('Scrap not found', HttpStatus.NOT_FOUND);
      }
      // V2 returns all enhanced metadata fields
      return scrap;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Helper method to enrich scraps with enhanced metadata
   */
  private async enrichScrapsWithMetadata(
    scraps: any[],
    userId: string,
  ): Promise<ScrapResponseDto[]> {
    const scrapIds = scraps.map((scrap) => scrap.scrapId);
    return await this.scrapsService.findMany(scrapIds, userId);
  }

  // ========== VERSION 3 API - Unified Scraps (webclip + upload) with Infinite Scroll ==========

  /**
   * GET /api/v3/scraps - 현재 사용자의 모든 스크랩 조회 (webclip + upload 통합, 무한스크롤 지원)
   * Returns ScrapResponseDto with truncated content (100 chars) for list view
   */
  @Version('3')
  @Get()
  async findAllV3(
    @Request() req: any,
    @Query('type') type?: string, // 'webclip', 'upload', or undefined for all
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('sortBy') sortBy?: 'created_at' | 'updated_at' | 'title',
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ): Promise<{
    scraps: ScrapResponseDto[];
    total: number;
    hasMore: boolean;
    page: number;
    limit: number;
  }> {
    try {
      const userId = req.user.id;

      // Get user's scraps with pagination (webclip + upload unified)
      const result = await this.scrapsService.findByUserV2(
        userId,
        sortBy,
        sortOrder,
        type,
        page,
        limit,
      );

      // Fetch full metadata for each scrap with truncated content (100 chars)
      const scrapIds = result.scraps.map((scrap) => scrap.scrapId);
      const scrapsWithMetadata = await this.scrapsService.findMany(
        scrapIds,
        userId,
      );

      return {
        scraps: scrapsWithMetadata,
        total: result.total,
        hasMore: result.hasMore,
        page,
        limit,
      };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
