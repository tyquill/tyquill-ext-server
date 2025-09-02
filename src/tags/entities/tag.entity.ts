import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { Scrap } from '../../scraps/entities/scrap.entity';
import { User } from '../../users/entities/user.entity';
import { UploadedFile } from '../../uploaded-files/entities/uploaded-file.entity';

@Entity({ tableName: 'tags' })
export class Tag {
    @PrimaryKey({ name: 'tag_id' })
    tagId: number;

    @Property({ name: 'name', type: 'varchar', length: 100 })
    name: string;

    @Property({ name: 'created_at' })
    createdAt: Date = new Date();

    @ManyToOne(() => User, { fieldName: 'user_id' })
    user: User;

    @ManyToOne(() => Scrap, { fieldName: 'scrap_id' })
    scrap: Scrap;

    @ManyToOne(() => UploadedFile, { fieldName: 'uploaded_file_id' })
    uploadedFile: UploadedFile;
}
