import {
  Collection,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../users/entities/user.entity';
import { Scrap } from '../../scraps/entities/scrap.entity';
import { Article } from '../../articles/entities/article.entity';

@Entity({ tableName: 'folders' })
export class Folder {
  @PrimaryKey({ name: 'folder_id', type: 'uuid' })
  folderId: string = uuidv4();

  @Property({ name: 'name', type: 'varchar', length: 255 })
  name: string;

  @Property({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Property({ name: 'color', type: 'varchar', length: 50, nullable: true })
  color?: string;

  @Property({ name: 'icon', type: 'varchar', length: 100, nullable: true })
  icon?: string;

  @Property({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean = false;

  @Property({ name: 'created_at' })
  createdAt: Date = new Date();

  @Property({ name: 'updated_at', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @ManyToOne(() => User, { fieldName: 'user_id' })
  user: User;

  @ManyToOne(() => Folder, {
    fieldName: 'parent_folder_id',
    nullable: true,
  })
  parentFolder?: Folder;

  @OneToMany(() => Folder, (folder) => folder.parentFolder)
  childFolders = new Collection<Folder>(this);

  @OneToMany(() => Scrap, (scrap) => scrap.folder)
  scraps = new Collection<Scrap>(this);

  @OneToMany(() => Article, (article) => article.folder)
  articles = new Collection<Article>(this);

  /**
   * Get the full path of folder names from root to current folder
   */
  getPath(): string[] {
    const path: string[] = [this.name];
    let current = this.parentFolder;

    while (current) {
      path.unshift(current.name);
      current = current.parentFolder;
    }

    return path;
  }

  /**
   * Check if this folder is a descendant of the given folder
   */
  isDescendantOf(folder: Folder): boolean {
    let current = this.parentFolder;

    while (current) {
      if (current.folderId === folder.folderId) {
        return true;
      }
      current = current.parentFolder;
    }

    return false;
  }
}
