import { Module } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { ArticlesController } from '../api/articles/articles.controller';
import { AgentsModule } from '../agents/agents.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Article } from './entities/article.entity';
import { ArticleArchive } from '../article-archive/entities/article-archive.entity';
import { ArticleScrap } from './entities/article-scrap.entity';
import { Scrap } from '../scraps/entities/scrap.entity';
import { User } from '../users/entities/user.entity';
import { WritingStyle } from '../writing-styles/entities/writing-style.entity';
import { WritingStyleExample } from 'src/writing-styles/entities/writing-style-example.entity';
import { Folder } from '../folders/entities/folder.entity';
// Analytics tracking moved to client; module no longer required here.

@Module({
  imports: [
    MikroOrmModule.forFeature([
      Article,
      ArticleArchive,
      ArticleScrap,
      Scrap,
      User,
      WritingStyle,
      WritingStyleExample,
      Folder,
    ]),
    AgentsModule,
    NotificationsModule,
  ],
  controllers: [ArticlesController],
  providers: [ArticlesService],
  exports: [ArticlesService],
})
export class ArticlesModule {}
