import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IncomingWebhook } from '@slack/webhook';

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private webhook: IncomingWebhook | null = null;

  constructor(private configService: ConfigService) {
    const webhookUrl =
      this.configService.get<string>('SLACK_WEBHOOK_URL') ||
      'https://hooks.slack.com/services/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';
    if (webhookUrl) {
      this.webhook = new IncomingWebhook(webhookUrl);
      this.logger.log('Slack webhook initialized');
    } else {
      this.logger.warn('Slack webhook URL not configured');
    }
  }

  /**
   * Send new user signup notification to Slack
   */
  async notifyNewUserSignup(userData: {
    email: string;
    name: string;
    userId: string;
    provider?: string;
    createdAt?: Date;
  }): Promise<void> {
    if (!this.webhook) {
      this.logger.debug('Slack webhook not configured, skipping notification');
      return;
    }

    try {
      const timestamp = userData.createdAt || new Date();
      const formattedDate = timestamp.toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      await this.webhook.send({
        text: '🎉 신규 유저 가입',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🎉 신규 유저 가입 알림',
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*이메일:*\n${userData.email}`,
              },
              {
                type: 'mrkdwn',
                text: `*이름:*\n${userData.name}`,
              },
              {
                type: 'mrkdwn',
                text: `*User ID:*\n${userData.userId}`,
              },
              {
                type: 'mrkdwn',
                text: `*가입 방법:*\n${userData.provider || 'Google OAuth'}`,
              },
              {
                type: 'mrkdwn',
                text: `*가입 시간:*\n${formattedDate}`,
              },
              {
                type: 'mrkdwn',
                text: `*환경:*\n${process.env.NODE_ENV || 'development'}`,
              },
            ],
          },
          {
            type: 'divider',
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Tyquill Backend | ${new Date().toISOString()}`,
              },
            ],
          },
        ],
      });

      this.logger.log(
        `Slack notification sent for new user: ${userData.email}`,
      );
    } catch (error) {
      this.logger.error('Failed to send Slack notification:', error);
      // Don't throw error to prevent signup failure
    }
  }

  /**
   * Send general notification to Slack
   */
  async sendNotification(message: string, details?: any): Promise<void> {
    if (!this.webhook) {
      this.logger.debug('Slack webhook not configured, skipping notification');
      return;
    }

    try {
      await this.webhook.send({
        text: message,
        ...(details && {
          attachments: [
            {
              color: 'good',
              text: JSON.stringify(details, null, 2),
            },
          ],
        }),
      });

      this.logger.log(`Slack notification sent: ${message}`);
    } catch (error) {
      this.logger.error('Failed to send Slack notification:', error);
    }
  }

  /**
   * Send article generation notification to Slack
   */
  async notifyArticleGeneration(articleData: {
    articleId: string;
    title: string;
    topic: string;
    keyInsight?: string;
    userEmail: string;
    userName: string;
    userId: string;
    generationTime?: number;
    contentLength?: number;
    version?: string; // API version used (V1, V2, V3)
    createdAt?: Date;
  }): Promise<void> {
    if (!this.webhook) {
      this.logger.debug('Slack webhook not configured, skipping notification');
      return;
    }

    try {
      const timestamp = articleData.createdAt || new Date();
      const formattedDate = timestamp.toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const generationTimeText = articleData.generationTime
        ? `${(articleData.generationTime / 1000).toFixed(1)}초`
        : '측정 불가';

      const contentLengthText = articleData.contentLength
        ? `${articleData.contentLength.toLocaleString()}자`
        : '측정 불가';

      await this.webhook.send({
        text: '🎉 아티클 생성 완료',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🎉 아티클 생성 완료 알림',
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*제목:*\n${articleData.title}`,
              },
              {
                type: 'mrkdwn',
                text: `*주제:*\n${articleData.topic}`,
              },
              {
                type: 'mrkdwn',
                text: `*사용자:*\n${articleData.userName} (${articleData.userEmail})`,
              },
              {
                type: 'mrkdwn',
                text: `*User ID:*\n${articleData.userId}`,
              },
              {
                type: 'mrkdwn',
                text: `*Article ID:*\n${articleData.articleId}`,
              },
              {
                type: 'mrkdwn',
                text: `*API 버전:*\n${articleData.version || 'V1'}`,
              },
            ],
          },
          ...(articleData.keyInsight
            ? [
                {
                  type: 'section',
                  fields: [
                    {
                      type: 'mrkdwn',
                      text: `*핵심 인사이트:*\n${articleData.keyInsight}`,
                    },
                  ],
                },
              ]
            : []),
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*생성 시간:*\n${generationTimeText}`,
              },
              {
                type: 'mrkdwn',
                text: `*콘텐츠 길이:*\n${contentLengthText}`,
              },
              {
                type: 'mrkdwn',
                text: `*완료 시간:*\n${formattedDate}`,
              },
              {
                type: 'mrkdwn',
                text: `*환경:*\n${process.env.NODE_ENV || 'development'}`,
              },
            ],
          },
          {
            type: 'divider',
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Tyquill Backend | ${new Date().toISOString()}`,
              },
            ],
          },
        ] as any,
      });

      this.logger.log(
        `Slack notification sent for article generation: ${articleData.articleId}`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to send article generation Slack notification:',
        error,
      );
      // Don't throw error to prevent article generation failure
    }
  }

  /**
   * Send error notification to Slack
   */
  async notifyError(error: Error, context?: string): Promise<void> {
    if (!this.webhook) {
      return;
    }

    try {
      await this.webhook.send({
        text: '⚠️ 에러 발생',
        attachments: [
          {
            color: 'danger',
            fields: [
              {
                title: 'Error Message',
                value: error.message,
                short: false,
              },
              {
                title: 'Context',
                value: context || 'Unknown',
                short: true,
              },
              {
                title: 'Environment',
                value: process.env.NODE_ENV || 'development',
                short: true,
              },
              {
                title: 'Stack Trace',
                value: error.stack?.substring(0, 500) || 'No stack trace',
                short: false,
              },
            ],
            footer: 'Tyquill Backend',
            ts: Math.floor(Date.now() / 1000).toString(),
          },
        ],
      });
    } catch (sendError) {
      this.logger.error(
        'Failed to send error notification to Slack:',
        sendError,
      );
    }
  }
}
