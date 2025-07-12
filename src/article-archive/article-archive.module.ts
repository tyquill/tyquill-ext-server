import { Module } from '@nestjs/common';
import { ArticleArchiveService } from './article-archive.service';
import { ArticleArchiveController } from '../api/article-archive/article-archive.controller';
import { ArticleArchive } from './entities/article-archive.entity';
import { Article } from '../articles/entities/article.entity';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
  imports: [MikroOrmModule.forFeature([ArticleArchive, Article])],
  controllers: [ArticleArchiveController],
  providers: [ArticleArchiveService],
  exports: [ArticleArchiveService],
})
export class ArticleArchiveModule {}
