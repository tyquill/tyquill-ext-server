import {
  Collection,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';
import { Tag } from '../../tags/entities/tag.entity';
import { User } from '../../users/entities/user.entity';
import { Folder } from '../../folders/entities/folder.entity';

@Entity({ tableName: 'scraps' })
export class Scrap {
  @PrimaryKey({
    name: 'scrap_id',
    type: 'uuid',
    defaultRaw: 'uuid_generate_v4()',
  })
  scrapId: string = uuidv4();

  @Property({
    name: 'legacy_scrap_id',
    type: 'integer',
    nullable: true,
    unique: true,
  })
  legacyScrapId?: number;

  @Property({ name: 'url', type: 'varchar', length: 2000 })
  url: string;

  @Property({ name: 'title', type: 'text' })
  title: string;

  @Property({ name: 'content', type: 'text' })
  content: string;

  @Property({
    name: 'content_info',
    type: 'json',
    columnType: 'jsonb',
    nullable: true,
  })
  contentInfo?: {
    raw?: string; // HTML with tags
    plain?: string; // Markdown format
    text?: string; // Pure text only
    language?: string;
    format?: string;
  };

  @Property({ name: 'html_content', type: 'text' })
  htmlContent: string;

  // Optional fields for uploaded files
  @Property({ name: 'file_name', type: 'varchar', length: 255, nullable: true })
  fileName?: string;

  @Property({ name: 'file_path', type: 'text', nullable: true })
  filePath?: string;

  @Property({ name: 'mime_type', type: 'varchar', length: 255, nullable: true })
  mimeType?: string;

  @Property({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize?: number;

  @Property({ name: 'ai_content', type: 'text', nullable: true })
  aiContent?: string;

  @Property({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean = false;

  @Property({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Property({ name: 'user_comment', type: 'text', nullable: true })
  userComment?: string;

  @Property({
    name: 'webpage',
    type: 'json',
    columnType: 'jsonb',
    nullable: true,
  })
  webpage?: {
    url?: string;
    title?: string;
    description?: string;
    site?: {
      host?: string;
      favicon_url?: string;
      name?: string;
    };
  };

  @Property({ name: 'hero_image_url', type: 'text', nullable: true })
  heroImageUrl?: string;

  @Property({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt?: Date;

  @Property({
    name: 'authors',
    type: 'json',
    columnType: 'jsonb',
    nullable: true,
  })
  authors?: Array<{
    name?: string;
    picture?: string;
  }>;

  @Property({
    name: 'type',
    type: 'varchar',
    length: 50,
    nullable: true,
    default: 'webclip',
  })
  type?: string;

  @Property({
    name: 'from_source',
    type: 'varchar',
    length: 50,
    nullable: true,
    default: 'extension',
  })
  from?: string;

  @Property({ name: 'created_at' })
  createdAt: Date = new Date();

  @Property({ name: 'updated_at', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @ManyToOne(() => User, { fieldName: 'user_id' })
  user: User;

  @ManyToOne(() => Folder, {
    fieldName: 'folder_id',
    nullable: true,
  })
  folder?: Folder;

  @OneToMany(() => Tag, (tag) => tag.scrap)
  tags: Collection<Tag> = new Collection<Tag>(this);
}
