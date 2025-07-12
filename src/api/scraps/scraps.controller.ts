import { Controller, Get, Post, Body, Put, Param, Delete, Version, Query, ParseIntPipe, HttpException, HttpStatus } from '@nestjs/common';
import { ScrapsService, SearchOptions, PaginationOptions } from '../../scraps/scraps.service';
import { TagsService } from '../../tags/tags.service';
import { CreateScrapDto } from './dto/create-scrap.dto';
import { UpdateScrapDto } from './dto/update-scrap.dto';
import { CreateTagDto } from '../tags/dto/create-tag.dto';

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
    @Query('userId') userId?: number, // TODO: Replace with auth token
  ) {
    try {
      const resolvedUserId = userId || 1; // TODO: Get from auth token
      const { articleId, ...scrapData } = createScrapDto;
      
      return await this.scrapsService.create(scrapData, resolvedUserId, articleId);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /api/v1/scraps - 스크랩 목록 조회 (기본 검색)
   */
  @Version('1')
  @Get()
  async findAll(
    @Query('userId') userId?: number,
    @Query('articleId') articleId?: number,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    try {
      if (search) {
        return await this.scrapsService.search(search, userId);
      }

      if (articleId) {
        return await this.scrapsService.findByArticle(articleId);
      }

      if (userId) {
        return await this.scrapsService.findByUser(userId);
      }

      return await this.scrapsService.findAll();
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
    @Query('query') query?: string,
    @Query('userId') userId?: number,
    @Query('articleId') articleId?: number,
    @Query('tags') tags?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('sortBy') sortBy?: 'created_at' | 'updated_at' | 'title',
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    try {
      const searchOptions: SearchOptions = {
        query,
        userId,
        articleId,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        sortBy: sortBy || 'created_at',
        sortOrder: sortOrder || 'DESC',
      };

      const paginationOptions: PaginationOptions = {
        page: page || 1,
        limit: limit || 20,
      };

      return await this.scrapsService.advancedSearch(searchOptions, paginationOptions);
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
    @Query('tags') tags: string,
    @Query('userId') userId?: number,
    @Query('matchAll') matchAll?: boolean,
  ) {
    try {
      if (!tags || tags.trim().length === 0) {
        throw new HttpException('Tags parameter is required', HttpStatus.BAD_REQUEST);
      }

      const tagNames = tags.split(',').map(tag => tag.trim());
      return await this.scrapsService.findByTags(tagNames, userId, matchAll || false);
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
  async findOne(@Param('scrapId', ParseIntPipe) scrapId: number) {
    try {
      const scrap = await this.scrapsService.findOne(scrapId);
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
    @Param('scrapId', ParseIntPipe) scrapId: number,
    @Body() updateScrapDto: UpdateScrapDto,
  ) {
    try {
      const scrap = await this.scrapsService.update(scrapId, updateScrapDto);
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
   * DELETE /api/v1/scraps/:key - 스크랩 삭제
   */
  @Version('1')
  @Delete(':scrapId')
  async remove(@Param('scrapId', ParseIntPipe) scrapId: number) {
    try {
      await this.scrapsService.remove(scrapId);
      return { message: 'Scrap deleted successfully' };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/v1/scraps/user/:userId - 특정 사용자의 스크랩 목록
   */
  @Version('1')
  @Get('user/:userId')
  async findByUser(@Param('userId', ParseIntPipe) userId: number) {
    try {
      return await this.scrapsService.findByUser(userId);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/v1/scraps/article/:articleId - 특정 기사의 스크랩 목록
   */
  @Version('1')
  @Get('article/:articleId')
  async findByArticle(@Param('articleId', ParseIntPipe) articleId: number) {
    try {
      return await this.scrapsService.findByArticle(articleId);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ========== 스크랩-태그 관계 관리 API ==========

  /**
   * POST /api/v1/scraps/:scrapKey/tags - 스크랩에 태그 추가
   */
  @Version('1')
  @Post(':scrapId/tags')
  async addTagToScrap(
    @Param('scrapId', ParseIntPipe) scrapId: number,
    @Body() createTagDto: CreateTagDto,
    @Query('userId') userId?: number, // TODO: Replace with auth token
  ) {
    try {
      const resolvedUserId = userId || 1; // TODO: Get from auth token
      
      // 스크랩 존재 확인
      const scrap = await this.scrapsService.findOne(scrapId);
      if (!scrap) {
        throw new HttpException('Scrap not found', HttpStatus.NOT_FOUND);
      }

      // 태그 생성 (scrapKey와 함께)
      const tagData = { ...createTagDto, scrapId };
      return await this.tagsService.create(tagData, resolvedUserId, scrapId);
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /api/v1/scraps/:scrapKey/tags - 스크랩의 태그 목록 조회
   */
  @Version('1')
  @Get(':scrapId/tags')
  async getScrapTags(@Param('scrapId', ParseIntPipe) scrapId: number) {
    try {
      // 스크랩 존재 확인
      const scrap = await this.scrapsService.findOne(scrapId);
      if (!scrap) {
        throw new HttpException('Scrap not found', HttpStatus.NOT_FOUND);
      }

      return await this.tagsService.findByScrap(scrapId);
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * DELETE /api/v1/scraps/:scrapKey/tags/:tagId - 스크랩에서 태그 제거
   */
  @Version('1')
  @Delete(':scrapId/tags/:tagId')
  async removeTagFromScrap(
    @Param('scrapId', ParseIntPipe) scrapId: number,
    @Param('tagId', ParseIntPipe) tagId: number,
    @Query('userId') userId?: number, // TODO: Replace with auth token
  ) {
    try {
      const resolvedUserId = userId || 1; // TODO: Get from auth token
      
      // 스크랩 존재 확인
      const scrap = await this.scrapsService.findOne(scrapId);
      if (!scrap) {
        throw new HttpException('Scrap not found', HttpStatus.NOT_FOUND);
      }

      // 태그 존재 및 권한 확인 후 삭제
      await this.tagsService.removeFromScrap(resolvedUserId, scrapId, tagId);
      return { message: 'Tag removed from scrap successfully' };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
