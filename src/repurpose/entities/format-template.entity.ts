import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Enum,
} from '@mikro-orm/core';
import { User } from '../../users/entities/user.entity';
import { ContentFormat } from './content-format.enum';

/**
 * 포맷 템플릿을 저장하는 엔티티
 * 사용자가 커스텀 포맷 템플릿을 생성하고 재사용할 수 있습니다.
 */
@Entity({ tableName: 'format_templates' })
export class FormatTemplate {
  @PrimaryKey({ type: 'integer', autoincrement: true })
  id!: number;

  @ManyToOne(() => User, { fieldName: 'creator_id' })
  creator!: User;

  @Property({ type: 'varchar', length: 255 })
  name!: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Enum(() => ContentFormat)
  format!: ContentFormat;

  @Property({ type: 'text' })
  promptTemplate!: string;

  /**
   * 포맷 규칙 정의
   */
  @Property({ type: 'json' })
  rules!: {
    maxCharacters?: number;
    minCharacters?: number;
    maxWords?: number;
    minWords?: number;
    tone?: string; // 'professional' | 'casual' | 'humorous' | 'educational'
    structure?: string; // 'hook-body-cta' | 'problem-solution' | 'listicle'
    includeEmojis?: boolean;
    includeHashtags?: boolean;
    maxHashtags?: number;
    includeCTA?: boolean;
    [key: string]: any;
  };

  /**
   * 템플릿 변수 정의 (예: {{tone}}, {{length}}, {{cta}})
   */
  @Property({ type: 'json', nullable: true })
  variables?: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'enum';
    defaultValue?: any;
    options?: string[]; // enum 타입일 경우
  }>;

  @Property({ type: 'boolean', default: false })
  isPublic: boolean = false;

  @Property({ type: 'integer', default: 0 })
  usageCount: number = 0;

  @Property({ type: 'float', default: 0 })
  rating: number = 0;

  @Property({ type: 'boolean', default: true })
  isActive: boolean = true;

  @Property({ fieldName: 'created_at', onCreate: () => new Date() })
  createdAt = new Date();

  @Property({ fieldName: 'updated_at', onUpdate: () => new Date() })
  updatedAt = new Date();
}
