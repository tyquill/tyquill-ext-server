import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Version } from '@nestjs/common';
import { ArticlesService } from '../../articles/articles.service';
import { CreateArticleDto, GenerateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@Controller('articles')
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
   * AI를 사용하여 아티클을 생성합니다
   * POST /api/v1/articles/generate
  */
  @Version('1')
  @Post('generate')
  async generateArticle(
    @Body() generateArticleDto: GenerateArticleDto,
    @Query('userId') userId: string
  ) {
    const userIdNumber = parseInt(userId, 10);
    if (isNaN(userIdNumber)) {
      throw new Error('유효하지 않은 사용자 ID입니다');
    }
    return this.articlesService.generateArticle(userIdNumber, generateArticleDto);
  }

  @Get()
  findAll() {
    return this.articlesService.findAll();
  }

  /**
   * 아티클 조회
   * GET /api/v1/articles/:id
   */
  @Version('1')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.articlesService.findOne(+id);
  }

  /**
   * 아티클의 모든 버전 조회
   * GET /api/v1/articles/:id/versions
   */
  @Version('1')
  @Get(':id/versions')
  findVersions(@Param('id') id: string) {
    return this.articlesService.findVersions(+id);
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

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.articlesService.remove(+id);
  }
}
