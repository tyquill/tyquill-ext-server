import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { Article } from '../articles/entities/article.entity';
import { ArticleArchive } from '../article-archive/entities/article-archive.entity';
import { User } from '../users/entities/user.entity';
import { UserOAuth, OAuthProvider } from '../users/entities/user-oauth.entity';
import {
  GenerateReportDto,
  SlackMessageDto,
  DateRangeDto,
} from './dto/generate-report.dto';
import { ReportResponseDto } from './dto/report-response.dto';
import { SlackReportGeneratorService } from './slack-report-generator.service';

/**
 * Slack Bot 서비스
 *
 * Slack 메시지를 받아서 AI 기반 주간 보고서를 생성합니다.
 * 단일 LLM 호출로 빠른 생성 (5-10초)
 */
@Injectable()
export class SlackBotService {
  private readonly logger = new Logger(SlackBotService.name);

  constructor(
    private readonly em: EntityManager,
    @InjectRepository(Article)
    private readonly articleRepository: EntityRepository<Article>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    @InjectRepository(UserOAuth)
    private readonly userOAuthRepository: EntityRepository<UserOAuth>,
    private readonly configService: ConfigService,
    private readonly reportGenerator: SlackReportGeneratorService,
  ) {}

  /**
   * Slack 메시지로 주간 보고서 생성
   *
   * 빠른 단일 LLM 호출로 5-10초 내 완료
   */
  async generateReport(dto: GenerateReportDto): Promise<ReportResponseDto> {
    this.logger.log('Generating report from Slack messages (fast mode)', {
      messageCount: dto.messageCount,
      topic: dto.topic,
      dateRange: dto.dateRange,
    });

    const startTime = Date.now();

    try {
      // 1. Slack 사용자로 Tyquill User 매핑 (자동 생성)
      const user = await this.findOrCreateUserBySlackId(
        dto.slackUserId,
        dto.slackTeamId,
        dto.slackUserName,
      );

      // 2. Slack 메시지를 프롬프트 형식으로 변환
      const formattedMessages = this.formatMessagesForPrompt(
        dto.messages,
        dto.dateRange,
      );

      this.logger.debug('Formatted messages for AI', {
        messageLength: formattedMessages.length,
      });

      // 3. AI로 빠른 보고서 생성 (단일 LLM 호출)
      const { title, content } = await this.reportGenerator.generateReport({
        topic: dto.topic,
        keyInsight: dto.keyInsight,
        messages: formattedMessages,
      });

      const aiGenerationTime = Date.now() - startTime;

      this.logger.log('AI report generated', {
        title,
        contentLength: content.length,
        aiTime: `${aiGenerationTime}ms`,
      });

      // 4. Article 엔티티 생성 및 저장
      const article = new Article();
      article.topic = dto.topic;
      article.keyInsight = dto.keyInsight;
      article.generationParams = formattedMessages;
      article.generationStatus = 'completed';
      article.user = user;

      await this.em.persistAndFlush(article);

      // 5. ArticleArchive에 콘텐츠 저장
      const archive = new ArticleArchive();
      archive.title = title;
      archive.content = content;
      archive.versionNumber = 1;
      archive.article = article;

      await this.em.persistAndFlush(archive);

      const totalTime = Date.now() - startTime;

      this.logger.log('Report saved to database', {
        articleId: article.articleId,
        totalTime: `${totalTime}ms`,
      });

      // 6. 응답 반환
      return {
        articleId: article.articleId,
        content,
        topic: dto.topic,
        generationStatus: 'completed',
        createdAt: article.createdAt,
      };
    } catch (error) {
      this.logger.error('Failed to generate report', error);
      throw error;
    }
  }

  /**
   * 보고서 조회 (articleId로)
   */
  async getReport(articleId: string): Promise<ReportResponseDto | null> {
    this.logger.log('Fetching report from database', { articleId });

    try {
      // Article과 최신 ArticleArchive 조회
      const article = await this.em.findOne(
        Article,
        { articleId },
        {
          populate: ['archives'],
          orderBy: { archives: { versionNumber: 'DESC' } },
        },
      );

      if (!article) {
        this.logger.warn('Report not found', { articleId });
        return null;
      }

      // 최신 버전의 archive 가져오기
      const latestArchive = article.archives?.getItems()[0];

      if (!latestArchive) {
        this.logger.warn('Report has no archive content', { articleId });
        return null;
      }

      this.logger.log('Report fetched successfully', {
        articleId,
        versionNumber: latestArchive.versionNumber,
      });

      // For getReport, we only return if status is 'completed'
      // If it's 'processing' or 'failed', we return null or completed with warning
      const status = article.generationStatus === 'completed' ? 'completed' : 'failed';

      return {
        articleId: article.articleId,
        content: latestArchive.content,
        topic: latestArchive.title || 'Untitled Report',
        generationStatus: status,
        createdAt: article.createdAt,
      };
    } catch (error) {
      this.logger.error('Failed to fetch report', { articleId, error });
      throw error;
    }
  }

  /**
   * 서비스 계정 ID 가져오기
   */
  private getServiceAccountId(): number {
    const serviceAccountId = this.configService.get<string>(
      'SLACK_BOT_SERVICE_ACCOUNT_ID',
    );

    if (!serviceAccountId) {
      throw new Error('SLACK_BOT_SERVICE_ACCOUNT_ID is not configured');
    }

    return parseInt(serviceAccountId, 10);
  }

  /**
   * Slack User ID로 사용자 찾기 또는 생성
   *
   * UserOAuth 테이블을 사용하여 Slack 사용자를 Tyquill User와 매핑합니다.
   * 기존 매핑이 없으면 새로운 User와 UserOAuth 레코드를 자동 생성합니다.
   */
  async findOrCreateUserBySlackId(
    slackUserId: string,
    slackTeamId: string,
    slackUserName?: string,
  ): Promise<User> {
    this.logger.debug('Finding or creating user by Slack ID', {
      slackUserId,
      slackTeamId,
      slackUserName,
    });

    // 1. Slack OAuth 레코드 찾기
    let userOAuth = await this.userOAuthRepository.findOne(
      {
        oauthProvider: OAuthProvider.SLACK,
        oauthId: slackUserId,
      },
      { populate: ['user'] },
    );

    // 2. 기존 OAuth 레코드가 있으면 User 반환
    if (userOAuth) {
      this.logger.debug('Found existing Slack user', {
        userId: userOAuth.user.userId,
        slackUserId,
      });
      return userOAuth.user;
    }

    // 3. 새로운 User와 UserOAuth 생성
    this.logger.log('Creating new user for Slack ID', {
      slackUserId,
      slackTeamId,
      slackUserName,
    });

    // 3-1. User 생성
    const user = new User();
    user.email = `slack_${slackUserId}@tyquill-slack-bot.local`; // 임시 이메일
    user.name = slackUserName || `Slack User ${slackUserId.substring(0, 8)}`;

    await this.em.persistAndFlush(user);

    // 3-2. UserOAuth 생성
    userOAuth = new UserOAuth({
      oauthProvider: OAuthProvider.SLACK,
      oauthId: slackUserId,
      user,
      profileData: {
        slack_user_id: slackUserId,
        slack_team_id: slackTeamId,
        slack_user_name: slackUserName,
      },
    });

    await this.em.persistAndFlush(userOAuth);

    this.logger.log('Created new user and OAuth mapping', {
      userId: user.userId,
      slackUserId,
    });

    return user;
  }

  /**
   * Slack 메시지를 AI 프롬프트용 문자열로 변환
   */
  private formatMessagesForPrompt(
    messages: SlackMessageDto[],
    dateRange: DateRangeDto,
  ): string {
    const formattedMessages = messages
      .map((msg, index) => {
        const date = new Date(parseFloat(msg.timestamp) * 1000);
        const dateStr = date.toLocaleDateString('ko-KR', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        const channel = msg.channelName ? `#${msg.channelName}` : msg.channel;
        return `[${index + 1}] ${dateStr} (${channel}): ${msg.text}`;
      })
      .join('\n\n');

    return `
기간: ${dateRange.from} ~ ${dateRange.to}
총 메시지: ${messages.length}개

=== Slack 메시지 목록 ===

${formattedMessages}
    `.trim();
  }

  /**
   * 헬스 체크
   */
  async healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'slack-bot-api',
    };
  }
}
