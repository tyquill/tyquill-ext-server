import { Controller, Get, Post, Body, Put, Param, Delete, Version, Query, ParseIntPipe, HttpException, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { TagsService } from '../../tags/tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  /**
   * POST /api/v1/tags - 태그 생성
   */
  @Version('1')
  @Post()
  async create(
    @Request() req: any,
    @Body() createTagDto: CreateTagDto,
    @Query('scrapId') scrapId?: number,
  ) {
    try {
      const userId = parseInt(req.user.id); // JWT에서 사용자 ID 추출
      return await this.tagsService.create(createTagDto, userId, scrapId);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /api/v1/tags - 현재 사용자의 태그 목록 조회
   */
  @Version('1')
  @Get()
  async findAll(
    @Request() req: any,
    @Query('name') name?: string,
    @Query('scrapId') scrapId?: number,
  ) {
    try {
      const userId = parseInt(req.user.id); // JWT에서 사용자 ID 추출

      if (name) {
        return await this.tagsService.getTagsByName(userId, name);
      }

      if (scrapId) {
        return await this.tagsService.findByUserAndScrap(userId, scrapId);
      }

      return await this.tagsService.findByUser(userId);
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
   * GET /api/v1/tags/names - 현재 사용자의 고유 태그명 목록
   */
  @Version('1')
  @Get('names')
  async getUserTagNames(@Request() req: any) {
    try {
      const userId = parseInt(req.user.id); // JWT에서 사용자 ID 추출
      return await this.tagsService.getUserTagNames(userId);
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
