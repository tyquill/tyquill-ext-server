import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/core';
import { Article } from './article.entity';
import { Scrap } from '../../scraps/entities/scrap.entity';

/**
 * Junction entity for Many-to-Many relationship between Article and Scrap
 * Tracks which scraps were used to generate which articles
 */
@Entity({ tableName: 'article_scraps' })
@Unique({ properties: ['article', 'scrap'] })
export class ArticleScrap {
  @PrimaryKey({ fieldName: 'article_scrap_id' })
  articleScrapId!: number;

  @ManyToOne(() => Article, { fieldName: 'article_id' })
  article!: Article;

  @ManyToOne(() => Scrap, { fieldName: 'scrap_id' })
  scrap!: Scrap;

  /**
   * Optional per-article comment override for this scrap
   * Falls back to scrap.userComment if NULL
   */
  @Property({ fieldName: 'user_comment', type: 'text', nullable: true })
  userComment?: string;

  @Property({ fieldName: 'created_at', onCreate: () => new Date() })
  createdAt = new Date();
}
