import {
  Collection,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { Article } from '../../articles/entities/article.entity';
import { User } from '../../users/entities/user.entity';
import { ArticleChatMessage } from './article-chat-message.entity';

@Entity({ tableName: 'article_chat_sessions' })
export class ArticleChatSession {
  @PrimaryKey({
    fieldName: 'session_id',
    type: 'uuid',
    defaultRaw: 'uuid_generate_v4()',
  })
  sessionId!: string;

  @ManyToOne(() => Article, { fieldName: 'article_id' })
  article!: Article;

  @ManyToOne(() => User, { fieldName: 'user_id' })
  user!: User;

  @Property({ fieldName: 'title', type: 'varchar', length: 500, nullable: true })
  title?: string;

  @Property({ fieldName: 'summary', type: 'text', nullable: true })
  summary?: string;

  @Property({
    fieldName: 'checkpoint_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  checkpointId?: string;

  @Property({ fieldName: 'checkpoint_data', type: 'jsonb', nullable: true })
  checkpointData?: any;

  @Property({ fieldName: 'message_count', type: 'integer', default: 0 })
  messageCount: number = 0;

  @Property({ fieldName: 'total_tokens', type: 'integer', default: 0 })
  totalTokens: number = 0;

  @Property({
    fieldName: 'total_cost_usd',
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 0,
  })
  totalCostUsd: number = 0;

  @Property({ fieldName: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true;

  @Property({
    fieldName: 'last_message_at',
    type: 'timestamptz',
    nullable: true,
  })
  lastMessageAt?: Date;

  @Property({ fieldName: 'created_at', onCreate: () => new Date() })
  createdAt = new Date();

  @Property({ fieldName: 'updated_at', onUpdate: () => new Date() })
  updatedAt = new Date();

  @OneToMany(() => ArticleChatMessage, (message) => message.session)
  messages = new Collection<ArticleChatMessage>(this);
}
