    import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { Scrap } from '../../scraps/entities/scrap.entity';

@Entity()
export class Tag {
    @PrimaryKey({ name: 'tag_id' })
    tagId: number;

    @Property({ name: 'name' })
    name: string;
    
    @Property({ name: 'created_at' })
    createdAt: Date = new Date();

    @Property({ name: 'updated_at', onUpdate: () => new Date() })
    updatedAt: Date = new Date();

    @ManyToOne(() => Scrap)
    scrap: Scrap;
}
