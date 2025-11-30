import { IsString, IsEnum, IsOptional, IsNumber } from 'class-validator';

export enum ChatMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

export class ChatMessageDto {
  @IsEnum(ChatMessageRole)
  role: ChatMessageRole;

  @IsString()
  content: string;

  @IsOptional()
  @IsNumber()
  sequenceNumber?: number;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsNumber()
  promptTokens?: number;

  @IsOptional()
  @IsNumber()
  completionTokens?: number;

  @IsOptional()
  @IsNumber()
  totalTokens?: number;

  @IsOptional()
  @IsNumber()
  latencyMs?: number;

  @IsOptional()
  @IsNumber()
  costUsd?: number;

  @IsOptional()
  metadata?: any;
}

export class SaveConversationHistoryDto {
  @IsString()
  articleId: string;

  @IsString()
  userId: string;

  messages: ChatMessageDto[];

  @IsOptional()
  @IsString()
  checkpointId?: string;

  @IsOptional()
  checkpointData?: any;
}
