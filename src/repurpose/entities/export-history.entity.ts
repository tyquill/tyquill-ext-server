import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Enum,
  Index,
} from '@mikro-orm/core';
import { User } from '../../users/entities/user.entity';
import { RepurposedContent } from './repurposed-content.entity';
import { ExportDestination } from './content-format.enum';

/**
 * 익스포트 이력을 저장하는 엔티티
 * 리퍼포징된 콘텐츠를 외부 플랫폼으로 내보낸 기록을 추적합니다.
 */
@Entity({ tableName: 'export_histories' })
export class ExportHistory {
  @PrimaryKey({ type: 'integer', autoincrement: true })
  id!: number;

  @ManyToOne(() => User, { fieldName: 'user_id' })
  user!: User;

  @ManyToOne(() => RepurposedContent, {
    fieldName: 'repurposed_content_id',
    nullable: true,
  })
  repurposedContent?: RepurposedContent;

  /**
   * 일괄 익스포트의 경우 여러 콘텐츠 ID를 JSON 배열로 저장
   */
  @Property({ type: 'text', nullable: true })
  repurposedContentIds?: string;

  @Enum(() => ExportDestination)
  destination!: ExportDestination;

  /**
   * 익스포트 관련 메타데이터
   * - Notion: notionPageId, notionPageUrl
   * - Google Docs: googleDocUrl
   * - Buffer: bufferPostId
   * - Zapier: webhookUrl
   */
  @Property({ type: 'json', nullable: true })
  metadata?: {
    notionPageId?: string;
    notionPageUrl?: string;
    googleDocUrl?: string;
    bufferPostId?: string;
    webhookUrl?: string;
    [key: string]: any;
  };

  @Property({ type: 'boolean', default: true })
  success: boolean = true;

  @Property({ type: 'text', nullable: true })
  errorMessage?: string;

  @Property({ fieldName: 'exported_at', onCreate: () => new Date() })
  exportedAt = new Date();

  @Index()
  @Property({ fieldName: 'date_partition', columnType: 'date' })
  datePartition!: Date;
}
