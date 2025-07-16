import { Collection, Entity, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/core';
import { CreateArticleDto } from '../../api/articles/dto/create-article.dto';
import { ArticleArchive } from '../../article-archive/entities/article-archive.entity';
import { User } from '../../users/entities/user.entity';
import { Scrap } from '../../scraps/entities/scrap.entity';

@Entity({ tableName: 'articles' })
export class Article {
  @PrimaryKey({ fieldName: 'article_id' })
  articleId!: number;


  @Property({ fieldName: 'topic', type: 'varchar', length: 100 })
  topic!: string;

  @Property({ fieldName: 'key_insight', type: 'text' })
  keyInsight: string;

  @Property({ fieldName: 'generation_params', type: 'text', nullable: true })
  generationParams?: string;

  @Property({ fieldName: 'created_at', onCreate: () => new Date() })
  createdAt = new Date();

  @Property({ fieldName: 'updated_at', onUpdate: () => new Date() })
  updatedAt = new Date();

  @ManyToOne(() => User, { fieldName: 'user_id' })
  user!: User;

  @OneToMany(() => ArticleArchive, archive => archive.article)
  archives = new Collection<ArticleArchive>(this);

  @OneToMany(() => Scrap, scrap => scrap.article)
  scraps = new Collection<Scrap>(this);

  /**
   * CreateArticleDto로부터 Article 인스턴스를 생성합니다
   */
  static fromCreateArticleDto(createArticleDto: CreateArticleDto): Article {
    const article = new Article();
    article.topic = createArticleDto.topic;
    article.keyInsight = createArticleDto.keyInsights;
    article.generationParams = createArticleDto.generationParams;
    return article;
  }

  /**
   * 최신 버전의 아카이브에서 title을 가져옵니다
   */
  getLatestTitle(): string | undefined {
    const latestArchive = this.archives
      .getItems()
      .sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0))[0];
    
    return latestArchive?.title;
  }

  /**
   * 최신 버전의 아카이브에서 content를 가져옵니다
   */
  getLatestContent(): string | undefined {
    const latestArchive = this.archives
      .getItems()
      .sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0))[0];
    
    return latestArchive?.content;
  }

  /**
   * 최신 버전의 아카이브를 가져옵니다
   */
  getLatestArchive(): ArticleArchive | undefined {
    return this.archives
      .getItems()
      .sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0))[0];
  }
}
