import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import mikroOrmConfig from './mikro-orm.config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ScrapsModule } from './scraps/scraps.module';
import { TagsModule } from './tags/tags.module';
import { ArticlesModule } from './articles/articles.module';
import { ArticleArchiveModule } from './article-archive/article-archive.module';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({}),
    MikroOrmModule.forRoot(mikroOrmConfig),
    UsersModule,
    ScrapsModule,
    TagsModule,
    ArticlesModule,
    ArticleArchiveModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
