import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ArticleChatService } from './services/article-chat.service';
import { ArticleChatSession } from './entities/article-chat-session.entity';
import { ArticleChatMessage } from './entities/article-chat-message.entity';
import { Article } from '../articles/entities/article.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      ArticleChatSession,
      ArticleChatMessage,
      Article,
      User,
    ]),
  ],
  providers: [ArticleChatService],
  exports: [ArticleChatService],
})
export class ArticleChatModule {}
