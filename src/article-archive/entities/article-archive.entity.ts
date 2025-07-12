import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { Article } from '../../articles/entities/article.entity';

@Entity()
export class ArticleArchive {
  @PrimaryKey({ name: 'article_archive_id' })
  articleArchiveId: number;

  @Property({ name: 'title' })
  title: string;

  @Property({ name: 'content' })
  content: string;

  @Property({ name: 'version_number' })
  versionNumber: number = 1;

  @Property({ name: 'created_at' })
  createdAt: Date = new Date();

  @ManyToOne(() => Article)
  article: Article;
}
