import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { ArticleChatSession } from '../entities/article-chat-session.entity';
import { ArticleChatMessage } from '../entities/article-chat-message.entity';
import { Article } from '../../articles/entities/article.entity';
import { User } from '../../users/entities/user.entity';
import { ChatMessageDto, SaveConversationHistoryDto } from '../dto/chat-message.dto';

@Injectable()
export class ArticleChatService {
  private readonly logger = new Logger(ArticleChatService.name);

  constructor(
    @InjectRepository(ArticleChatSession)
    private readonly sessionRepository: EntityRepository<ArticleChatSession>,
    @InjectRepository(ArticleChatMessage)
    private readonly messageRepository: EntityRepository<ArticleChatMessage>,
    @InjectRepository(Article)
    private readonly articleRepository: EntityRepository<Article>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    private readonly em: EntityManager,
  ) {}

  /**
   * 특정 아티클에 대한 활성 세션을 조회하거나 생성합니다
   */
  async getOrCreateSession(
    articleId: string,
    userId: string,
  ): Promise<ArticleChatSession> {
    // 기존 활성 세션 조회
    const existingSession = await this.sessionRepository.findOne({
      article: { articleId },
      user: { userId },
      isActive: true,
    });

    if (existingSession) {
      return existingSession;
    }

    // 아티클과 유저 존재 확인
    const article = await this.articleRepository.findOne({ articleId });
    if (!article) {
      throw new NotFoundException(`Article with ID ${articleId} not found`);
    }

    const user = await this.userRepository.findOne({ userId });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // 새 세션 생성
    const newSession = this.sessionRepository.create({
      article,
      user,
      isActive: true,
      messageCount: 0,
      totalTokens: 0,
      totalCostUsd: 0,
    });

    await this.em.persistAndFlush(newSession);
    this.logger.log(
      `Created new chat session ${newSession.sessionId} for article ${articleId}`,
    );

    return newSession;
  }

  /**
   * 대화 히스토리를 일괄 저장합니다
   */
  async saveConversationHistory(
    dto: SaveConversationHistoryDto,
  ): Promise<ArticleChatSession> {
    const session = await this.getOrCreateSession(dto.articleId, dto.userId);

    // 현재 세션의 최대 sequence_number 조회
    const maxSequence = await this.messageRepository
      .createQueryBuilder('m')
      .select('MAX(m.sequence_number)')
      .where({ session })
      .execute('get');

    let nextSequence = (maxSequence?.max || -1) + 1;

    // 메시지들을 순서대로 저장
    for (const messageDto of dto.messages) {
      const message = this.messageRepository.create({
        session,
        role: messageDto.role,
        content: messageDto.content,
        sequenceNumber: messageDto.sequenceNumber ?? nextSequence++,
        modelName: messageDto.modelName,
        promptTokens: messageDto.promptTokens,
        completionTokens: messageDto.completionTokens,
        totalTokens: messageDto.totalTokens,
        latencyMs: messageDto.latencyMs,
        costUsd: messageDto.costUsd,
        metadata: messageDto.metadata,
      });

      this.em.persist(message);
    }

    // 체크포인트 정보 업데이트 (있는 경우)
    if (dto.checkpointId) {
      session.checkpointId = dto.checkpointId;
      session.checkpointData = dto.checkpointData;
    }

    await this.em.flush();

    this.logger.log(
      `Saved ${dto.messages.length} messages to session ${session.sessionId}`,
    );

    return session;
  }

  /**
   * 세션의 최근 메시지를 조회합니다
   */
  async getRecentMessages(
    sessionId: string,
    limit: number = 10,
  ): Promise<ArticleChatMessage[]> {
    const messages = await this.messageRepository.find(
      { session: { sessionId } },
      {
        orderBy: { sequenceNumber: 'DESC' },
        limit,
      },
    );

    // 시간순 정렬 (오래된 것부터)
    return messages.reverse();
  }

  /**
   * 아티클의 최근 N개 메시지를 대화 컨텍스트 형식으로 조회합니다
   */
  async getRecentMessagesForArticle(
    articleId: string,
    userId: string,
    limit: number = 5,
  ): Promise<{ role: string; content: string }[]> {
    const session = await this.sessionRepository.findOne({
      article: { articleId },
      user: { userId },
      isActive: true,
    });

    if (!session) {
      return [];
    }

    const messages = await this.getRecentMessages(session.sessionId, limit);

    return messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));
  }

  /**
   * 개별 메시지를 저장합니다
   */
  async saveMessage(
    sessionId: string,
    messageDto: ChatMessageDto,
  ): Promise<ArticleChatMessage> {
    const session = await this.sessionRepository.findOneOrFail({ sessionId });

    // 다음 sequence number 계산
    const maxSequence = await this.messageRepository
      .createQueryBuilder('m')
      .select('MAX(m.sequence_number)')
      .where({ session })
      .execute('get');

    const nextSequence = (maxSequence?.max || -1) + 1;

    const message = this.messageRepository.create({
      session,
      role: messageDto.role,
      content: messageDto.content,
      sequenceNumber: messageDto.sequenceNumber ?? nextSequence,
      modelName: messageDto.modelName,
      promptTokens: messageDto.promptTokens,
      completionTokens: messageDto.completionTokens,
      totalTokens: messageDto.totalTokens,
      latencyMs: messageDto.latencyMs,
      costUsd: messageDto.costUsd,
      metadata: messageDto.metadata,
    });

    await this.em.persistAndFlush(message);

    this.logger.log(
      `Saved message ${message.messageId} to session ${sessionId}`,
    );

    return message;
  }

  /**
   * 세션을 비활성화합니다
   */
  async deactivateSession(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findOneOrFail({ sessionId });
    session.isActive = false;
    await this.em.flush();

    this.logger.log(`Deactivated chat session ${sessionId}`);
  }

  /**
   * 아티클의 모든 활성 세션을 조회합니다
   */
  async getActiveSessionsForArticle(
    articleId: string,
  ): Promise<ArticleChatSession[]> {
    return this.sessionRepository.find({
      article: { articleId },
      isActive: true,
    });
  }
}
