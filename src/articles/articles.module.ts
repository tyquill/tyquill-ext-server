import { Module } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { ArticlesController } from '../api/articles/articles.controller';
import { NewsletterAgentService } from '../services/newsletter-agent.service';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Article } from './entities/article.entity';
import { ArticleArchive } from '../article-archive/entities/article-archive.entity';
import { Scrap } from '../scraps/entities/scrap.entity';
import { User } from '../users/entities/user.entity';
import { WritingStyleExample } from 'src/writing-styles/entities/writing-style-example.entity';

@Module({
  imports: [
    MikroOrmModule.forFeature([Article, ArticleArchive, Scrap, User, WritingStyleExample]),
  ],
  controllers: [ArticlesController],
  providers: [ArticlesService, NewsletterAgentService],
  exports: [ArticlesService],
})
export class ArticlesModule {}
