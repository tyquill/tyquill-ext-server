import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Enum,
  Index,
} from '@mikro-orm/core';
import { Article } from '../../articles/entities/article.entity';
import { User } from '../../users/entities/user.entity';
import { FormatTemplate } from './format-template.entity';
import { ContentFormat } from './content-format.enum';

/**
 * 리퍼포징된 콘텐츠를 저장하는 엔티티
 * 하나의 Article을 여러 포맷으로 변환한 결과를 저장합니다.
 */
@Entity({ tableName: 'repurposed_contents' })
export class RepurposedContent {
  @PrimaryKey({ type: 'integer', autoincrement: true })
  id!: number;

  @ManyToOne(() => Article, { fieldName: 'article_id' })
  originalArticle!: Article;

  @ManyToOne(() => User, { fieldName: 'user_id' })
  user!: User;

  @Enum(() => ContentFormat)
  format!: ContentFormat;

  @Property({ type: 'text' })
  content!: string;

  /**
   * 포맷별 특화 데이터
   * - Twitter: threadTweets[], hashtags[]
   * - YouTube: timestamps[], seoKeywords[], description
   * - Email: subjectLines[], htmlBody, plainTextBody
   * - Instagram: carouselSlides[]
   * - TikTok: soundSuggestions[], durationSeconds
   */
  @Property({ type: 'json', nullable: true })
  formatSpecificData?: {
    // Twitter
    threadTweets?: string[];
    hashtags?: string[];

    // YouTube
    timestamps?: Array<{ time: string; title: string }>;
    seoKeywords?: string[];
    description?: string;

    // Email
    subjectLines?: string[];
    htmlBody?: string;
    plainTextBody?: string;

    // Instagram
    carouselSlides?: string[];

    // TikTok
    soundSuggestions?: string[];
    durationSeconds?: number;

    // Custom
    [key: string]: any;
  };

  @Property({ type: 'integer', default: 0 })
  qualityScore: number = 0;

  @Property({ type: 'json', nullable: true })
  qualityDetails?: {
    readability: number;
    seoScore?: number;
    engagementPrediction?: number;
    brandConsistency: number;
  };

  @Property({ type: 'integer', default: 0 })
  characterCount: number = 0;

  @Property({ type: 'integer', default: 0 })
  wordCount: number = 0;

  @Property({ type: 'boolean', default: false })
  isEdited: boolean = false;

  @ManyToOne(() => FormatTemplate, { fieldName: 'template_id', nullable: true })
  template?: FormatTemplate;

  @Property({ fieldName: 'created_at', onCreate: () => new Date() })
  createdAt = new Date();

  @Property({ fieldName: 'updated_at', onUpdate: () => new Date() })
  updatedAt = new Date();

  @Index()
  @Property({ fieldName: 'date_partition', columnType: 'date' })
  datePartition!: Date;
}
