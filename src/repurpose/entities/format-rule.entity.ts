import {
  Entity,
  PrimaryKey,
  Property,
  Enum,
  Unique,
} from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';
import { ContentFormat } from './content-format.enum';

/**
 * 플랫폼별 규칙을 저장하는 엔티티
 * 각 포맷의 제약사항과 베스트 프랙티스를 정의합니다.
 */
@Entity({ tableName: 'format_rules' })
export class FormatRule {
  @PrimaryKey({ type: 'uuid', onCreate: () => uuidv4() })
  id: string = uuidv4();

  @Enum(() => ContentFormat)
  @Unique()
  format!: ContentFormat;

  /**
   * 포맷 제약사항
   */
  @Property({ type: 'json' })
  constraints!: {
    maxCharacters?: number;
    minCharacters?: number;
    maxWords?: number;
    minWords?: number;
    maxHashtags?: number;
    maxMediaCount?: number;
    supportedMediaTypes?: string[];
    requiresCTA?: boolean;
    [key: string]: any;
  };

  /**
   * 베스트 프랙티스
   */
  @Property({ type: 'json' })
  bestPractices!: {
    tone?: string;
    structure?: string;
    hashtagStrategy?: string;
    emojiUsage?: string;
    ctaExamples?: string[];
    [key: string]: any;
  };

  /**
   * AI 시스템 프롬프트
   */
  @Property({ type: 'text' })
  systemPrompt!: string;

  @Property({ fieldName: 'created_at', onCreate: () => new Date() })
  createdAt = new Date();

  @Property({ fieldName: 'updated_at', onUpdate: () => new Date() })
  updatedAt = new Date();
}
