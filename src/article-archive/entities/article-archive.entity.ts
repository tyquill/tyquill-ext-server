import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { Article } from '../../articles/entities/article.entity';

@Entity({ tableName: 'article_archive' })
export class ArticleArchive {
  @PrimaryKey({ fieldName: 'article_archive_id' })
  articleArchiveId!: number;

  @Property({ fieldName: 'title', type: 'varchar', length: 500 })
  title!: string;

  @Property({ fieldName: 'content', type: 'text' })
  content!: string;

  @Property({ fieldName: 'version_number', type: 'int', nullable: true })
  versionNumber?: number;

  @Property({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean = false;

  @Property({ fieldName: 'created_at', onCreate: () => new Date() })
  createdAt = new Date();

  @ManyToOne(() => Article, { fieldName: 'article_id' })
  article!: Article;
}
