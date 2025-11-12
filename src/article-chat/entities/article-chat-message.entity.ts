import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { ArticleChatSession } from './article-chat-session.entity';

@Entity({ tableName: 'article_chat_messages' })
export class ArticleChatMessage {
  @PrimaryKey({
    fieldName: 'message_id',
    type: 'uuid',
    defaultRaw: 'uuid_generate_v4()',
  })
  messageId!: string;

  @ManyToOne(() => ArticleChatSession, { fieldName: 'session_id' })
  session!: ArticleChatSession;

  @Property({ fieldName: 'role', type: 'varchar', length: 20 })
  role!: 'user' | 'assistant' | 'system';

  @Property({ fieldName: 'content', type: 'text' })
  content!: string;

  @Property({
    fieldName: 'content_type',
    type: 'varchar',
    length: 20,
    default: 'text',
  })
  contentType: 'text' | 'markdown' | 'html' = 'text';

  @Property({ fieldName: 'sequence_number', type: 'integer' })
  sequenceNumber!: number;

  @ManyToOne(() => ArticleChatMessage, {
    fieldName: 'parent_message_id',
    nullable: true,
  })
  parentMessage?: ArticleChatMessage;

  @Property({
    fieldName: 'model_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  modelName?: string;

  @Property({ fieldName: 'prompt_tokens', type: 'integer', nullable: true })
  promptTokens?: number;

  @Property({ fieldName: 'completion_tokens', type: 'integer', nullable: true })
  completionTokens?: number;

  @Property({ fieldName: 'total_tokens', type: 'integer', nullable: true })
  totalTokens?: number;

  @Property({ fieldName: 'latency_ms', type: 'integer', nullable: true })
  latencyMs?: number;

  @Property({
    fieldName: 'cost_usd',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  costUsd?: number;

  @Property({ fieldName: 'metadata', type: 'jsonb', nullable: true })
  metadata?: any;

  @Property({ fieldName: 'created_at', onCreate: () => new Date() })
  createdAt = new Date();

  @Property({ fieldName: 'updated_at', onUpdate: () => new Date() })
  updatedAt = new Date();
}
