import { BeforeCreate, BeforeUpdate, Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { Scrap } from '../../scraps/entities/scrap.entity';
import { User } from '../../users/entities/user.entity';
import { UploadedFile } from '../../uploaded-files/entities/uploaded-file.entity';

@Entity({ tableName: 'tags' })
export class Tag {

    @BeforeCreate()
    validate() {
        const hasScrap = this.scrap !== null && this.scrap !== undefined;
        const hasUploadedFile = this.uploadedFile !== null && this.uploadedFile !== undefined;
        if ((hasScrap && hasUploadedFile) || (!hasScrap && !hasUploadedFile)) {
            throw new Error('Tag must have either scrap or uploaded file');
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

    @ManyToOne(() => UploadedFile, { fieldName: 'uploaded_file_id', nullable: true })
    uploadedFile?: UploadedFile;
}
