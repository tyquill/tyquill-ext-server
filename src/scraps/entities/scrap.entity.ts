import { Collection, Entity, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/core';
import { Tag } from '../../tags/entities/tag.entity';
import { User } from '../../users/entities/user.entity';
import { Article } from '../../articles/entities/article.entity';

@Entity({ tableName: 'Scraps' })
export class Scrap {
    @PrimaryKey({ name: 'scrap_id' })
    scrapId: number;

    @Property({ name: 'url', type: 'varchar', length: 2000 })
    url: string;

    @Property({ name: 'title'})
    title: string;

    @Property({ name: 'content'})
    content: string;

    @Property({ name: 'user_comment' })
    userComment?: string;

    @Property({ name: 'created_at' })
    createdAt: Date = new Date();

    @Property({ name: 'updated_at', onUpdate: () => new Date() })
    updatedAt: Date = new Date();

    @ManyToOne(() => User, { fieldName: 'user_id' })
    user: User;

    @ManyToOne(() => Article, { fieldName: 'article_id' })
    article: Article;

    @OneToMany(() => Tag, tag => tag.scrap)
    tags: Collection<Tag> = new Collection<Tag>(this);
}
