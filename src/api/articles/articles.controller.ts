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
import { GenerateArticleDto, GenerateArticleResponse } from './dto/generate-article.dto';
import { GenerateArticleV2Dto, GenerateArticleV2Response, ArticleStatusV2Response } from './dto/generate-article-v2.dto';
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
   * 페이지 콘텐츠를 분석하여 글 구조 템플릿을 생성합니다.
   * POST /api/v1/articles/analyze-structure
   */
  @Version('1')
  @Post('analyze-structure')
  @ApiOperation({ summary: '페이지 콘텐츠를 분석하여 글 구조 템플릿 생성' })
  @ApiResponse({ status: 201, description: '글 구조 분석 성공' })
  async analyzeStructure(@Body('content') content: string) {
    return this.articlesService.analyzePageStructure(content);
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
  async generateArticle(@Request() req: any, @Body() generateArticleDto: GenerateArticleDto): Promise<GenerateArticleResponse> {
    const userId = parseInt(req.user.id); // JWT에서 사용자 ID 추출
    return this.articlesService.generateArticle(userId, generateArticleDto);
  }

  /**
   * 현재 사용자의 아티클 조회
   * GET /api/v1/articles
   */
  @Version('1')
  @Get()
  findAll(@Request() req: any, @Query('sortBy') sortBy?: 'created_at' | 'updated_at' | 'title', @Query('sortOrder') sortOrder?: 'ASC' | 'DESC') {
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
  async remove(@Param('id') id: string) {
    await this.articlesService.remove(+id);
    return { message: 'Article removed successfully' };
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

  // ========== V2 API (비동기 생성) ==========

  /**
   * V2: AI를 사용하여 뉴스레터를 비동기로 생성합니다
   * POST /api/v2/articles/generate
   */
  @ApiOperation({ 
    summary: 'V2: AI를 사용하여 뉴스레터를 비동기로 생성합니다',
    description: '즉시 202 응답을 반환하고 백그라운드에서 생성을 진행합니다. 상태는 별도 API로 확인할 수 있습니다.'
  })
  @ApiResponse({ 
    status: 202, 
    description: '뉴스레터 생성이 시작되었습니다.',
    type: GenerateArticleV2Response
  })
  @ApiResponse({ status: 400, description: '잘못된 요청입니다.' })
  @ApiResponse({ status: 404, description: '사용자나 스크랩을 찾을 수 없습니다.' })
  @Version('2')
  @Post('generate')
  async generateArticleV2(@Request() req: any, @Body() generateArticleDto: GenerateArticleV2Dto): Promise<GenerateArticleV2Response> {
    const userId = parseInt(req.user.id);
    return this.articlesService.generateArticleV2(userId, generateArticleDto);
  }

  /**
   * V2: 아티클 생성 상태 확인
   * GET /api/v2/articles/:id/status
   */
  @ApiOperation({ 
    summary: 'V2: 아티클 생성 상태를 확인합니다',
    description: '비동기 생성 중인 아티클의 상태(processing/completed/failed)와 결과를 확인합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '아티클 상태 정보',
    type: ArticleStatusV2Response
  })
  @ApiResponse({ status: 404, description: '아티클을 찾을 수 없습니다.' })
  @Version('2')
  @Get(':id/status')
  async getArticleStatusV2(@Param('id') id: string): Promise<ArticleStatusV2Response> {
    return this.articlesService.getArticleStatusV2(+id);
  }

  /**
   * V2: 현재 사용자의 아티클 조회 (상태 정보 포함)
   * GET /api/v2/articles
   */
  @ApiOperation({ 
    summary: 'V2: 현재 사용자의 아티클 목록을 조회합니다',
    description: '생성 상태 정보가 포함된 아티클 목록을 반환합니다.'
  })
  @Version('2')
  @Get()
  findAllV2(@Request() req: any) {
    const userId = parseInt(req.user.id);
    return this.articlesService.findByUserV2(userId);
  }
}