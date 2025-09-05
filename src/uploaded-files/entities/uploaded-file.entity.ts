import { Entity, ManyToOne, PrimaryKey, Property, OneToMany, Collection } from "@mikro-orm/core";
import { Tag } from "../../tags/entities/tag.entity";
import { User } from "../../users/entities/user.entity";

@Entity({ tableName: 'uploaded_files' })
export class UploadedFile {
  @PrimaryKey({ name: 'uploaded_file_id' })
  uploadedFileId: number;

  @Property({ name: 'title' })
  title: string;

  @Property({ name: 'description' })
  description: string;

  @Property({ name: 'file_name' })
  fileName: string;

  @Property({ name: 'file_path' })
  filePath: string;

  @Property({ name: 'mime_type' })
  mimeType: string;

  @Property({ name: 'file_size' })
  fileSize: number;

  @Property({ name: 'ai_content', type: 'text', nullable: true })
  aiContent?: string;

  @Property({ name: 'created_at' })
  createdAt: Date = new Date();

  @ManyToOne(() => User, { fieldName: 'user_id' })
  user: User;

  @OneToMany(() => Tag, tag => tag.uploadedFile)
  tags: Collection<Tag> = new Collection<Tag>(this);

}
