import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../../users/entities/user.entity';
import { Article } from '../../articles/entities/article.entity';
import { Scrap } from '../../scraps/entities/scrap.entity';
import { ArticleArchive } from '../../article-archive/entities/article-archive.entity';

@Module({
  imports: [MikroOrmModule.forFeature([User, Article, Scrap, ArticleArchive])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
