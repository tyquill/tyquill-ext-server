import { Module } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { ArticlesController } from '../api/articles/articles.controller';
import { AgentsModule } from '../agents/agents.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Article } from './entities/article.entity';
import { ArticleArchive } from '../article-archive/entities/article-archive.entity';
import { Scrap } from '../scraps/entities/scrap.entity';
import { User } from '../users/entities/user.entity';
import { WritingStyle } from '../writing-styles/entities/writing-style.entity';
import { WritingStyleExample } from 'src/writing-styles/entities/writing-style-example.entity';
// Analytics tracking moved to client; module no longer required here.

@Module({
  imports: [
    MikroOrmModule.forFeature([
      Article,
      ArticleArchive,
      Scrap,
      User,
      WritingStyle,
      WritingStyleExample,
    ]),
    AgentsModule,
    NotificationsModule,
  ],
  controllers: [ArticlesController],
  providers: [ArticlesService],
  exports: [ArticlesService],
})
export class ArticlesModule {}
