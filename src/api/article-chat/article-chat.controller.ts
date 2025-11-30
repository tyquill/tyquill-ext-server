import { Controller, Get, Post, Param, UseGuards, Req, Version } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ArticleChatService } from '../../article-chat/services/article-chat.service';
import {
  SessionListItemDto,
  SessionMessagesDto,
} from './dto/session-list.dto';

@Controller('article-chat')
@UseGuards(JwtAuthGuard)
export class ArticleChatController {
  constructor(private readonly articleChatService: ArticleChatService) {}

  /**
   * 아티클의 모든 채팅 세션 목록 조회
   * GET /api/v1/article-chat/articles/:articleId/sessions
   */
  @Version('1')
  @Get('articles/:articleId/sessions')
  async getArticleSessions(
    @Param('articleId') articleId: string,
    @Req() req: any,
  ): Promise<SessionListItemDto[]> {
    const userId = req.user.id;
    const sessions = await this.articleChatService.getSessionsForArticle(
      articleId,
      userId,
    );

    return sessions.map((session) => ({
      sessionId: session.sessionId,
      title: session.title,
      summary: session.summary,
      messageCount: session.messageCount,
      lastMessageAt: session.lastMessageAt,
      isActive: session.isActive,
      createdAt: session.createdAt,
    }));
  }

  /**
   * 특정 세션의 메시지 조회
   * GET /api/v1/article-chat/sessions/:sessionId/messages
   */
  @Version('1')
  @Get('sessions/:sessionId/messages')
  async getSessionMessages(
    @Param('sessionId') sessionId: string,
  ): Promise<SessionMessagesDto> {
    const messages = await this.articleChatService.getSessionMessages(
      sessionId,
    );

    return {
      sessionId,
      messages: messages.map((msg) => ({
        messageId: msg.messageId,
        role: msg.role,
        content: msg.content,
        timestamp: msg.createdAt,
        modelName: msg.modelName,
        totalTokens: msg.totalTokens,
      })),
    };
  }

  /**
   * 새 채팅 세션 생성
   * POST /api/v1/article-chat/articles/:articleId/sessions/new
   */
  @Version('1')
  @Post('articles/:articleId/sessions/new')
  async createNewSession(
    @Param('articleId') articleId: string,
    @Req() req: any,
  ): Promise<{ sessionId: string; message: string }> {
    const userId = req.user.id;
    const newSession = await this.articleChatService.createNewSession(
      articleId,
      userId,
    );

    return {
      sessionId: newSession.sessionId,
      message: 'New chat session created successfully',
    };
  }
}
