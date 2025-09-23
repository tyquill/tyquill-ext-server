import {
  Collection,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
  Index,
  Unique,
} from '@mikro-orm/core';
import { User } from '../../users/entities/user.entity';
import { ScrapFolder } from './scrap-folder.entity';

@Entity({ tableName: 'folders' })
@Index({ properties: ['user', 'parentFolder'] })
@Index({ properties: ['user', 'isDeleted'] })
@Unique({ properties: ['user', 'name', 'parentFolder'] })
export class Folder {
  @PrimaryKey({ name: 'folder_id' })
  folderId: number;

  @Property({ name: 'name', type: 'varchar', length: 255 })
  name: string;

  @Property({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Property({ name: 'color', type: 'varchar', length: 7, nullable: true })
  color?: string; // Hex color code for UI customization

  @Property({ name: 'icon', type: 'varchar', length: 50, nullable: true })
  icon?: string; // Icon identifier for UI

  @Property({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number = 0;

  @Property({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean = false;

  @Property({ name: 'is_system', type: 'boolean', default: false })
  isSystem: boolean = false; // For system-generated folders (e.g., "Uncategorized")

  @Property({ name: 'created_at' })
  createdAt: Date = new Date();

  @Property({ name: 'updated_at', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Property({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  // User who owns this folder
  @ManyToOne(() => User, { fieldName: 'user_id' })
  user: User;

  // Self-referencing relationship for hierarchical structure
  @ManyToOne(() => Folder, { fieldName: 'parent_folder_id', nullable: true })
  parentFolder?: Folder;

  // Child folders
  @OneToMany(() => Folder, (folder) => folder.parentFolder)
  childFolders = new Collection<Folder>(this);

  // Many-to-many relationship with scraps through junction table
  @OneToMany(() => ScrapFolder, (scrapFolder) => scrapFolder.folder)
  scrapFolders = new Collection<ScrapFolder>(this);

  // Computed properties for easier access
  get scrapCount(): number {
    return this.scrapFolders.filter((sf) => !sf.isDeleted).length;
  }

  get hasChildren(): boolean {
    return this.childFolders.filter((cf) => !cf.isDeleted).length > 0;
  }

  get level(): number {
    let depth = 0;
    let current: Folder | undefined = this;
    while (current?.parentFolder) {
      depth++;
      current = current.parentFolder;
      // Prevent infinite loops in case of circular references
      if (depth > 10) break;
    }
    return depth;
  }

  // Get full path string (e.g., "Projects/Web Development/React")
  get fullPath(): string {
    const path: string[] = [];
    let current: Folder | undefined = this;
    while (current) {
      path.unshift(current.name);
      current = current.parentFolder;
      // Prevent infinite loops
      if (path.length > 10) break;
    }
    return path.join('/');
  }

  // Soft delete implementation
  softDelete(): void {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.updatedAt = new Date();
  }

  // Restore from soft delete
  restore(): void {
    this.isDeleted = false;
    this.deletedAt = undefined;
    this.updatedAt = new Date();
  }
}
