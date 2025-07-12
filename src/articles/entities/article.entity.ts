import { Collection, Entity, OneToMany, PrimaryKey, Property } from '@mikro-orm/core';
import { CreateArticleDto } from '../../api/articles/dto/create-article.dto';
import { ArticleArchive } from '../../article-archive/entities/article-archive.entity';

@Entity()
export class Article {
  @PrimaryKey({ name: 'article_id' })
  articleId: number;

  @Property({ name: 'generation_params' })
  generationParams: string;

  @Property({ name: 'topic' })
  topic: string;

  @Property({ name: 'key_insights' })
  keyInsights: string;

  @Property({ name: 'created_at' })
  createdAt: Date = new Date();

  @Property({ name: 'updated_at', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @OneToMany(() => ArticleArchive, articleArchive => articleArchive.article)
  articleArchives: Collection<ArticleArchive> = new Collection<ArticleArchive>(this);

  static fromCreateArticleDto(createArticleDto: CreateArticleDto) {
    const article = new Article();
    article.generationParams = createArticleDto.generationParams;
    article.topic = createArticleDto.topic;
    article.keyInsights = createArticleDto.keyInsights;
    return article;
  }
}
