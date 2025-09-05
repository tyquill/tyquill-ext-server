import { Logger, Module } from '@nestjs/common';
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
import { AuthModule } from './auth/auth.module';
import { WritingStylesModule } from './writing-styles/writing-styles.module';
import { UploadedFilesModule } from './uploaded-files/uploaded-files.module';
import { LibraryItemsModule } from './library-items/library-items.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MikroOrmModule.forRoot(mikroOrmConfig),
    AuthModule, // 인증 모듈 추가
    UsersModule,
    ScrapsModule,
    TagsModule,
    ArticlesModule,
    ArticleArchiveModule,
    WritingStylesModule,
    UploadedFilesModule,
    LibraryItemsModule,
    QueueModule, // SQS 큐 모듈 추가
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {

  private readonly logger = new Logger(AppModule.name);

  constructor() {
    this.logger.log('🚀 Application module initialized with OAuth authentication and SQS queues');
  }
}
