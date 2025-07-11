import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

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

    @Property({ name: 'updated_at', type: 'date'})
    updatedAt: Date;
}
