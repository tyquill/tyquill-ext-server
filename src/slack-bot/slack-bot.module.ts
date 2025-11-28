import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SlackBotController } from '../api/slack-bot/slack-bot.controller';
import { SlackBotService } from './slack-bot.service';
import { SlackReportGeneratorService } from './slack-report-generator.service';
import { AgentsModule } from '../agents/agents.module';
import { Article } from '../articles/entities/article.entity';
import { ArticleArchive } from '../article-archive/entities/article-archive.entity';
import { User } from '../users/entities/user.entity';
import { UserOAuth } from '../users/entities/user-oauth.entity';

/**
 * Slack Bot 모듈
 *
 * Slack Bot 전용 API를 제공합니다.
 * API Key 인증을 사용하여 빠른 보고서 생성 (단일 LLM 호출)
 */
@Module({
  imports: [
    MikroOrmModule.forFeature([Article, ArticleArchive, User, UserOAuth]),
    AgentsModule, // VertexAiFactory 사용
  ],
  controllers: [SlackBotController],
  providers: [SlackBotService, SlackReportGeneratorService],
  exports: [SlackBotService],
})
export class SlackBotModule {}
