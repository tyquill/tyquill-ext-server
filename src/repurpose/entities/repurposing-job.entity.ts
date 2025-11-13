import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Enum,
} from '@mikro-orm/core';
import { Article } from '../../articles/entities/article.entity';
import { User } from '../../users/entities/user.entity';
import { JobStatus, ContentFormat } from './content-format.enum';

/**
 * 리퍼포징 작업을 추적하는 엔티티
 * 비동기 리퍼포징 작업의 진행 상태를 관리합니다.
 */
@Entity({ tableName: 'repurposing_jobs' })
export class RepurposingJob {
  @PrimaryKey({ type: 'integer', autoincrement: true })
  id!: number;

  @ManyToOne(() => User, { fieldName: 'user_id' })
  user!: User;

  @ManyToOne(() => Article, { fieldName: 'article_id', nullable: true })
  article?: Article;

  /**
   * 배치 리퍼포징의 경우 여러 아티클 ID를 JSON 배열로 저장
   */
  @Property({ type: 'text', nullable: true })
  articleIds?: string;

  /**
   * 생성할 포맷 목록 (JSON 배열)
   */
  @Property({ type: 'text' })
  formats!: string;

  @Enum(() => JobStatus)
  status: JobStatus = JobStatus.PENDING;

  @Property({ type: 'integer', default: 0 })
  progress: number = 0;

  /**
   * 포맷별 진행률 (예: { "twitter": 50, "linkedin": 100 })
   */
  @Property({ type: 'json', nullable: true })
  formatProgress?: Record<string, number>;

  @Property({ fieldName: 'started_at', nullable: true })
  startedAt?: Date;

  @Property({ fieldName: 'completed_at', nullable: true })
  completedAt?: Date;

  @Property({ type: 'text', nullable: true })
  errorMessage?: string;

  /**
   * 작업 결과 요약
   */
  @Property({ type: 'json', nullable: true })
  result?: {
    successCount: number;
    failedFormats: string[];
    repurposedContentIds: number[];
  };

  @Property({ fieldName: 'created_at', onCreate: () => new Date() })
  createdAt = new Date();

  @Property({ fieldName: 'updated_at', onUpdate: () => new Date() })
  updatedAt = new Date();
}
