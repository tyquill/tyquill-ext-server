import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
  Index,
  Unique,
} from '@mikro-orm/core';
import { Scrap } from '../../scraps/entities/scrap.entity';
import { Folder } from './folder.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ tableName: 'scrap_folders' })
@Index({ properties: ['scrap', 'folder'] })
@Index({ properties: ['folder', 'isDeleted'] })
@Index({ properties: ['scrap', 'isDeleted'] })
@Index({ properties: ['user', 'isDeleted'] })
@Unique({ properties: ['scrap', 'folder'] })
export class ScrapFolder {
  @PrimaryKey({ name: 'scrap_folder_id' })
  scrapFolderId: number;

  @Property({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean = false;

  @Property({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number = 0; // For custom ordering within folder

  @Property({ name: 'created_at' })
  createdAt: Date = new Date();

  @Property({ name: 'updated_at', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  // Foreign key relationships
  @ManyToOne(() => Scrap, { fieldName: 'scrap_id' })
  scrap: Scrap;

  @ManyToOne(() => Folder, { fieldName: 'folder_id' })
  folder: Folder;

  @ManyToOne(() => User, { fieldName: 'user_id' })
  user: User;

  // Metadata for the relationship
  @Property({ name: 'note', type: 'text', nullable: true })
  notes?: string; // User notes about why this scrap is in this folder

  @Property({ name: 'is_pinned', type: 'boolean', default: false })
  isPinned: boolean = false; // Pin important scraps to top of folder

  // Soft delete implementation
  softDelete(): void {
    this.isDeleted = true;
    this.updatedAt = new Date();
  }

  // Restore from soft delete
  restore(): void {
    this.isDeleted = false;
    this.updatedAt = new Date();
  }
}
