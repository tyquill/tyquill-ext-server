import { Collection, Entity, OneToMany, PrimaryKey, Property } from '@mikro-orm/core';
import { Tag } from '../../tags/entities/tag.entity';

@Entity()
export class Scrap {
    @PrimaryKey({ name: 'scrap_id' })
    scrapId: number;

    @Property({ name: 'url'})
    url: string;

    @Property({ name: 'title'})
    title: string;

    @Property({ name: 'content'})
    content: string;

    @Property({ name: 'created_at', type: 'date'})
    createdAt: Date;

    @Property({ name: 'updated_at', type: 'date', onUpdate: () => new Date() })
    updatedAt: Date;

    @OneToMany(() => Tag, tag => tag.scrap)
    tags: Collection<Tag> = new Collection<Tag>(this);
}
