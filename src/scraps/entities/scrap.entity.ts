import {
  Collection,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
  wrap,
} from '@mikro-orm/core';
import { Tag } from '../../tags/entities/tag.entity';
import { User } from '../../users/entities/user.entity';
import { Article } from '../../articles/entities/article.entity';
import { ScrapFolder } from '../../folders/entities/scrap-folder.entity';
import { Folder } from '../../folders/entities/folder.entity';

@Entity({ tableName: 'scraps' })
export class Scrap {
  @PrimaryKey({ name: 'scrap_id' })
  scrapId: number;

  @Property({ name: 'url', type: 'varchar', length: 2000 })
  url: string;

  @Property({ name: 'title', type: 'text' })
  title: string;

  @Property({ name: 'content', type: 'text' })
  content: string;

  @Property({ name: 'content_info', type: 'json', nullable: true })
  contentInfo?: {
    raw?: string;     // HTML with tags
    plain?: string;   // Markdown format
    text?: string;    // Pure text only
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

  @Property({ name: 'webpage', type: 'json', nullable: true })
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

  @Property({ name: 'authors', type: 'json', nullable: true })
  authors?: Array<{
    name?: string;
    picture?: string;
  }>;

  @Property({ name: 'type', type: 'varchar', length: 50, nullable: true, default: 'webclip' })
  type?: string;

  @Property({ name: 'from_source', type: 'varchar', length: 50, nullable: true, default: 'extension' })
  from?: string;

  @Property({ name: 'created_at' })
  createdAt: Date = new Date();

  @Property({ name: 'updated_at', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @ManyToOne(() => User, { fieldName: 'user_id' })
  user: User;

  @ManyToOne(() => Article, { fieldName: 'article_id', nullable: true })
  article?: Article;

  @OneToMany(() => Tag, (tag) => tag.scrap)
  tags: Collection<Tag> = new Collection<Tag>(this);

  // Many-to-many relationship with folders through junction table
  @OneToMany(() => ScrapFolder, (scrapFolder) => scrapFolder.scrap)
  scrapFolders = new Collection<ScrapFolder>(this);

  // Computed property to get folders this scrap belongs to
  get folders(): Folder[] {
    const activeScrapFolders = this.activeScrapFolders;

    // Check if any scrapFolder has unloaded folder relation
    const hasUnloadedRelations = activeScrapFolders.some(
      (sf) => !wrap(sf.folder).isInitialized(),
    );

    if (hasUnloadedRelations) {
      throw new Error(
        'Cannot access folders: scrapFolders.folder relation not populated. ' +
          'Use populate: ["scrapFolders.folder"] when loading scraps.',
      );
    }

    return activeScrapFolders.map((sf) => sf.folder);
  }

  // Computed property to get active ScrapFolder relationships (with metadata)
  get activeScrapFolders(): ScrapFolder[] {
    return this.scrapFolders.getItems().filter((sf) => !sf.isDeleted);
  }

  /**
   * Helper method to check if scrap is in a specific folder
   *
   * @param folderId - The folder ID to check
   * @returns true if the scrap is in the specified folder
   * @throws Error if scrapFolders.folder relation is not populated
   *
   * @example
   * // Ensure proper population when loading scraps:
   * const scraps = await scrapRepository.find(query, {
   *   populate: ['scrapFolders.folder']
   * });
   */
  isInFolder(folderId: number): boolean {
    const activeScrapFolders = this.activeScrapFolders;

    // Check if any scrapFolder has unloaded folder relation
    const hasUnloadedRelations = activeScrapFolders.some(
      (sf) => !wrap(sf.folder).isInitialized(),
    );

    if (hasUnloadedRelations) {
      throw new Error(
        'Cannot check folder membership: scrapFolders.folder relation not populated. ' +
          'Use populate: ["scrapFolders.folder"] when loading scraps.',
      );
    }

    return activeScrapFolders.some((sf) => sf.folder.folderId === folderId);
  }

  /**
   * Helper method to get folder names this scrap belongs to
   *
   * @returns Array of folder names
   * @throws Error if scrapFolders.folder relation is not populated
   *
   * @example
   * // Ensure proper population when loading scraps:
   * const scraps = await scrapRepository.find(query, {
   *   populate: ['scrapFolders.folder']
   * });
   */
  getFolderNames(): string[] {
    const activeScrapFolders = this.activeScrapFolders;

    // Check if any scrapFolder has unloaded folder relation
    const hasUnloadedRelations = activeScrapFolders.some(
      (sf) => !wrap(sf.folder).isInitialized(),
    );

    if (hasUnloadedRelations) {
      throw new Error(
        'Cannot get folder names: scrapFolders.folder relation not populated. ' +
          'Use populate: ["scrapFolders.folder"] when loading scraps.',
      );
    }

    return activeScrapFolders.map((sf) => sf.folder.name);
  }
}
