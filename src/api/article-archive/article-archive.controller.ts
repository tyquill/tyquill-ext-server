import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ArticleArchiveService } from '../../article-archive/article-archive.service';
import { CreateArticleArchiveDto } from './dto/create-article-archive.dto';
import { UpdateArticleArchiveDto } from './dto/update-article-archive.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('article-archive')
export class ArticleArchiveController {
  constructor(private readonly articleArchiveService: ArticleArchiveService) {}

  @Post()
  create(@Body() createArticleArchiveDto: CreateArticleArchiveDto) {
    return this.articleArchiveService.create(createArticleArchiveDto);
  }

  @Get()
  findAll() {
    return this.articleArchiveService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.articleArchiveService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateArticleArchiveDto: UpdateArticleArchiveDto) {
    return this.articleArchiveService.update(+id, updateArticleArchiveDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.articleArchiveService.remove(+id);
  }
}
