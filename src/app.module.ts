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
import { FoldersModule } from './folders/folders.module';
import { ContentModule } from './content/content.module';
import { SlackBotModule } from './slack-bot/slack-bot.module';
import { ArticleChatModule } from './article-chat/article-chat.module';
import { RepurposeModule } from './repurpose/repurpose.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 100, // Default: 100 requests per minute for general endpoints
      },
    ]),
    MikroOrmModule.forRoot(mikroOrmConfig),
    HealthModule, // Health check 엔드포인트
    AuthModule, // 인증 모듈 추가
    UsersModule,
    ScrapsModule,
    TagsModule,
    ArticlesModule,
    ArticleArchiveModule,
    WritingStylesModule,
    UploadedFilesModule,
    LibraryItemsModule,
    FoldersModule, // 폴더 모듈 추가
    ContentModule, // 통합 콘텐츠 모듈 추가
    QueueModule, // Job Queue 모듈 추가
    SlackBotModule, // Slack Bot API 모듈 추가
    ArticleChatModule, // 채팅 세션 및 메시지 모듈 추가
    RepurposeModule, // 멀티포맷 리퍼포징 모듈 추가
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {
  private readonly logger = new Logger(AppModule.name);

  constructor() {
    this.logger.log(
      '🚀 Application module initialized with OAuth authentication',
    );
  }
}
