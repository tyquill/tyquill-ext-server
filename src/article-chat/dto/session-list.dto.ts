export interface SessionListItemDto {
  sessionId: string;
  title?: string;
  summary?: string;
  messageCount: number;
  lastMessageAt?: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface SessionMessagesDto {
  sessionId: string;
  messages: {
    messageId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    modelName?: string;
    totalTokens?: number;
  }[];
}
