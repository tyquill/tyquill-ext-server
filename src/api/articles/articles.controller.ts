import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Version,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ArticlesService } from '../../articles/articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { GenerateArticleDto } from './dto/generate-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('articles')
@UseGuards(JwtAuthGuard)
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  /**
   * 아티클 생성
   * POST /api/v1/articles
   */
  @Version('1')
  @Post()
  create(@Body() createArticleDto: CreateArticleDto) {
    return this.articlesService.create(createArticleDto);
  }

  /**
   * AI를 사용하여 뉴스레터를 생성합니다
   * POST /api/v1/articles/generate
   */
  @ApiOperation({ summary: 'AI를 사용하여 고품질 뉴스레터를 생성합니다' })
  @ApiResponse({ status: 201, description: '뉴스레터가 성공적으로 생성되었습니다.' })
  @ApiResponse({ status: 400, description: '잘못된 요청입니다.' })
  @ApiResponse({ status: 404, description: '사용자나 스크랩을 찾을 수 없습니다.' })
  @Version('1')
  @Post('generate')
  async generateArticle(@Request() req: any, @Body() generateArticleDto: GenerateArticleDto) {
    const userId = parseInt(req.user.id); // JWT에서 사용자 ID 추출
    return this.articlesService.generateArticle(userId, generateArticleDto);
  }

  /**
   * 현재 사용자의 아티클 조회
   * GET /api/v1/articles
   */
  @Version('1')
  @Get()
  findAll(@Request() req: any) {
    const userId = parseInt(req.user.id); // JWT에서 사용자 ID 추출
    return this.articlesService.findByUser(userId);
  }

  /**
   * 특정 아티클 조회
   * GET /api/v1/articles/:id
   */
  @Version('1')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.articlesService.findOne(+id);
  }


  /**
   * 아티클 검색
   * GET /api/v1/articles/search?q=검색어
   */
  @Version('1')
  @Get('search')
  search(@Request() req: any, @Query('q') query: string) {
    const userId = parseInt(req.user.id); // JWT에서 사용자 ID 추출
    return this.articlesService.search(query, userId);
  }


  /**
   * 아티클 업데이트
   * PATCH /api/v1/articles/:id
   */
  @Version('1')
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateArticleDto: UpdateArticleDto) {
    return this.articlesService.update(+id, updateArticleDto);
  }

  /**
   * 아티클 삭제
   * DELETE /api/v1/articles/:id
   */
  @Version('1')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.articlesService.remove(+id);
  }

  /**
   * 아티클 아카이브
   * POST /api/v1/articles/:id/archive
   */
  @Version('1')
  @Post(':id/archive')
  archive(@Param('id') id: string) {
    return this.articlesService.archive(+id);
  }

  /**
   * 배치 아티클 삭제
   * DELETE /api/v1/articles/batch
   */
  @Version('1')
  @Delete('batch')
  removeBatch(@Body() ids: number[]) {
    return this.articlesService.removeBatch(ids);
  }
}
