import { Module } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { ArticlesController } from '../api/articles/articles.controller';
import { AiGenerationService } from './ai-generation.service';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Article } from './entities/article.entity';
import { ArticleArchive } from '../article-archive/entities/article-archive.entity';
import { Scrap } from '../scraps/entities/scrap.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [MikroOrmModule.forFeature([Article, ArticleArchive, Scrap, User])],
  controllers: [ArticlesController],
  providers: [ArticlesService, AiGenerationService],
  exports: [ArticlesService, AiGenerationService],
})
export class ArticlesModule {}
