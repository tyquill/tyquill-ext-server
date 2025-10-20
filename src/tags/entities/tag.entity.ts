import {
  BeforeCreate,
  BeforeUpdate,
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { Scrap } from '../../scraps/entities/scrap.entity';
import { Article } from '../../articles/entities/article.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ tableName: 'tags' })
export class Tag {
  @BeforeCreate()
  validate() {
    const hasScrap = this.scrap !== null && this.scrap !== undefined;
    const hasArticle = this.article !== null && this.article !== undefined;

    if (!hasScrap && !hasArticle) {
      throw new Error('Tag must be associated with either a scrap or an article');
    }

    if (hasScrap && hasArticle) {
      throw new Error('Tag cannot be associated with both a scrap and an article');
    }
  }

  @PrimaryKey({ name: 'tag_id' })
  tagId: number;

  @Property({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Property({ name: 'created_at' })
  createdAt: Date = new Date();

  @ManyToOne(() => User, { fieldName: 'user_id' })
  user: User;

  @ManyToOne(() => Scrap, { fieldName: 'scrap_id', nullable: true })
  scrap?: Scrap;

  @ManyToOne(() => Article, { fieldName: 'article_id', nullable: true })
  article?: Article;
}
