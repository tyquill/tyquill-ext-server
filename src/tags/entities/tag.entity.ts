import { BeforeCreate, BeforeUpdate, Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { Scrap } from '../../scraps/entities/scrap.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ tableName: 'tags' })
export class Tag {

    @BeforeCreate()
    validate() {
        const hasScrap = this.scrap !== null && this.scrap !== undefined;
        if (!hasScrap) {
            throw new Error('Tag must be associated with a scrap');
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

    // UploadedFile relation removed; uploads are represented as scraps with file metadata
}
