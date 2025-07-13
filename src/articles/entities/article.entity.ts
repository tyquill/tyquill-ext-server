import { Collection, Entity, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/core';
import { CreateArticleDto } from '../../api/articles/dto/create-article.dto';
import { ArticleArchive } from '../../article-archive/entities/article-archive.entity';
import { User } from '../../users/entities/user.entity';
import { Scrap } from '../../scraps/entities/scrap.entity';

@Entity({ tableName: 'Articles' })
export class Article {
  @PrimaryKey({ fieldName: 'article_id' })
  articleId!: number;

  // 뉴스레터 제목과 내용 추가
  @Property({ fieldName: 'title', type: 'varchar', length: 500, nullable: true })
  title?: string;

  @Property({ fieldName: 'content', type: 'text', nullable: true })
  content?: string;

  @Property({ fieldName: 'topic', type: 'varchar', length: 100 })
  topic!: string;

  @Property({ fieldName: 'key_insight', type: 'text' })
  keyInsight: string;

  @Property({ fieldName: 'generation_params', type: 'text', nullable: true })
  generationParams?: string; // AI 생성 설정 JSON

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
    article.title = createArticleDto.title;
    article.content = createArticleDto.content;
    return article;
  }
}
