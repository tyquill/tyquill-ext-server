import { Controller, Get, Post, Body, Put, Param, Delete, Version, Query, ParseIntPipe, HttpException, HttpStatus } from '@nestjs/common';
import { TagsService } from '../../tags/tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  /**
   * POST /api/v1/tags - 태그 생성
   */
  @Version('1')
  @Post()
  async create(
    @Body() createTagDto: CreateTagDto,
    @Query('userId') userId?: number, // TODO: Replace with auth token
  ) {
    try {
      const resolvedUserId = userId || 1; // TODO: Get from auth token
      const { scrapKey, ...tagData } = createTagDto;
      
      if (!scrapKey) {
        throw new HttpException('scrapKey is required', HttpStatus.BAD_REQUEST);
      }
      
      return await this.tagsService.create(tagData, resolvedUserId, scrapKey);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /api/v1/tags - 사용자별 태그 목록
   */
  @Version('1')
  @Get()
  async findAll(
    @Query('userId') userId?: number,
    @Query('scrapKey') scrapKey?: number,
    @Query('name') name?: string,
  ) {
    try {
      if (name && userId) {
        return await this.tagsService.getTagsByName(userId, name);
      }

      if (userId && scrapKey) {
        return await this.tagsService.findByUserAndScrap(userId, scrapKey);
      }

      if (scrapKey) {
        return await this.tagsService.findByScrap(scrapKey);
      }

      if (userId) {
        return await this.tagsService.findByUser(userId);
      }

      return await this.tagsService.findAll();
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/v1/tags/:tagId - 태그 상세 조회
   */
  @Version('1')
  @Get(':tagId')
  async findOne(@Param('tagId', ParseIntPipe) tagId: number) {
    try {
      const tag = await this.tagsService.findOne(tagId);
      if (!tag) {
        throw new HttpException('Tag not found', HttpStatus.NOT_FOUND);
      }
      return tag;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * PUT /api/v1/tags/:tagId - 태그 수정
   */
  @Version('1')
  @Put(':tagId')
  async update(
    @Param('tagId', ParseIntPipe) tagId: number,
    @Body() updateTagDto: UpdateTagDto,
  ) {
    try {
      const tag = await this.tagsService.update(tagId, updateTagDto);
      if (!tag) {
        throw new HttpException('Tag not found', HttpStatus.NOT_FOUND);
      }
      return tag;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * DELETE /api/v1/tags/:tagId - 태그 삭제
   */
  @Version('1')
  @Delete(':tagId')
  async remove(@Param('tagId', ParseIntPipe) tagId: number) {
    try {
      await this.tagsService.remove(tagId);
      return { message: 'Tag deleted successfully' };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/v1/tags/user/:userId - 특정 사용자의 태그 목록
   */
  @Version('1')
  @Get('user/:userId')
  async findByUser(@Param('userId', ParseIntPipe) userId: number) {
    try {
      return await this.tagsService.findByUser(userId);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/v1/tags/user/:userId/names - 특정 사용자의 고유 태그 이름 목록
   */
  @Version('1')
  @Get('user/:userId/names')
  async getUniqueTagNames(@Param('userId', ParseIntPipe) userId: number) {
    try {
      return await this.tagsService.getUniqueTagNames(userId);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/v1/tags/scrap/:scrapId - 특정 스크랩의 태그 목록
   */
  @Version('1')
  @Get('scrap/:scrapId')
  async findByScrap(@Param('scrapId', ParseIntPipe) scrapId: number) {
    try {
      return await this.tagsService.findByScrap(scrapId);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
