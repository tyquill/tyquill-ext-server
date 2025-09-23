import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  EntityManager,
  EntityRepository,
  QueryOrder,
  FilterQuery,
} from '@mikro-orm/postgresql';
import { Folder } from '../entities/folder.entity';
import { ScrapFolder } from '../entities/scrap-folder.entity';
import { Scrap } from '../../scraps/entities/scrap.entity';
import {
  CreateFolderDto,
  UpdateFolderDto,
  MoveScrapsToFolderDto,
  RemoveScrapsFromFolderDto,
  FolderQueryDto,
  IFolderTreeNode,
  IFolderWithScraps,
  IFolderStats,
  FolderNotFoundError,
  CircularReferenceError,
  FolderNameConflictError,
} from '../types/folder.types';

@Injectable()
export class FolderService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(Folder)
    private readonly folderRepository: EntityRepository<Folder>,
    @InjectRepository(ScrapFolder)
    private readonly scrapFolderRepository: EntityRepository<ScrapFolder>,
    @InjectRepository(Scrap)
    private readonly scrapRepository: EntityRepository<Scrap>,
  ) {}

  /**
   * Create a new folder for the specified user
   */
  async createFolder(
    userId: number,
    createFolderDto: CreateFolderDto,
  ): Promise<Folder> {
    const {
      name,
      description,
      color,
      icon,
      sortOrder = 0,
      parentFolderId,
    } = createFolderDto;

    // Check for name conflicts within the same parent
    await this.checkNameConflict(userId, name, parentFolderId);

    // Validate parent folder exists and belongs to user
    let parentFolder: Folder | undefined;
    if (parentFolderId) {
      parentFolder = await this.findUserFolder(userId, parentFolderId);
    }

    const folder = new Folder();
    folder.name = name;
    folder.description = description;
    folder.color = color;
    folder.icon = icon;
    folder.sortOrder = sortOrder;
    folder.user = { userId } as any;
    folder.parentFolder = parentFolder;

    await this.em.persistAndFlush(folder);
    return folder;
  }

  /**
   * Update an existing folder
   */
  async updateFolder(
    userId: number,
    folderId: number,
    updateFolderDto: UpdateFolderDto,
  ): Promise<Folder> {
    const folder = await this.findUserFolder(userId, folderId);

    const {
      name,
      description,
      color,
      icon,
      sortOrder,
      parentFolderId,
      isDeleted,
    } = updateFolderDto;

    // Check for name conflicts if name is being changed
    if (name && name !== folder.name) {
      await this.checkNameConflict(
        userId,
        name,
        parentFolderId ?? folder.parentFolder?.folderId,
      );
    }

    // Validate parent folder and check for circular references
    if (parentFolderId !== undefined) {
      if (parentFolderId === null) {
        folder.parentFolder = undefined;
      } else {
        const parentFolder = await this.findUserFolder(userId, parentFolderId);
        await this.checkCircularReference(folderId, parentFolderId);
        folder.parentFolder = parentFolder;
      }
    }

    // Update properties
    if (name !== undefined) folder.name = name;
    if (description !== undefined) folder.description = description;
    if (color !== undefined) folder.color = color;
    if (icon !== undefined) folder.icon = icon;
    if (sortOrder !== undefined) folder.sortOrder = sortOrder;
    if (isDeleted !== undefined) {
      if (isDeleted) {
        folder.softDelete();
      } else {
        folder.restore();
      }
    }

    await this.em.flush();
    return folder;
  }

  /**
   * Delete a folder (soft delete)
   */
  async deleteFolder(userId: number, folderId: number): Promise<void> {
    const folder = await this.findUserFolder(userId, folderId);

    if (folder.isSystem) {
      throw new BadRequestException('Cannot delete system folders');
    }

    // Soft delete the folder and all its contents
    folder.softDelete();

    // Soft delete all scrap-folder relationships
    const scrapFolders = await this.scrapFolderRepository.find({
      folder: folder,
      isDeleted: false,
    });

    scrapFolders.forEach((sf) => sf.softDelete());

    await this.em.flush();
  }

  /**
   * Restore a deleted folder
   */
  async restoreFolder(userId: number, folderId: number): Promise<void> {
    const folder = await this.folderRepository.findOne({
      folderId,
      user: { userId },
      isDeleted: true,
    });

    if (!folder) {
      throw new FolderNotFoundError(folderId);
    }

    folder.restore();
    await this.em.flush();
  }

  /**
   * Get folder tree structure for a user
   */
  async getFolderTree(
    userId: number,
    query?: FolderQueryDto,
  ): Promise<IFolderTreeNode[]> {
    const {
      search,
      includeDeleted = false,
      includeSystem = true,
      parentId,
      sortBy = 'sortOrder',
      sortOrder = 'asc',
    } = query || {};

    const filters: FilterQuery<Folder> = {
      user: { userId },
      isDeleted: includeDeleted ? undefined : false,
      isSystem: includeSystem ? undefined : false,
      parentFolder: parentId ? { folderId: parentId } : null,
    };

    if (search) {
      filters.name = { $like: `%${search}%` };
    }

    const folders = await this.folderRepository.find(filters, {
      populate: ['parentFolder', 'childFolders', 'scrapFolders'],
      orderBy: {
        [sortBy]: sortOrder === 'asc' ? QueryOrder.ASC : QueryOrder.DESC,
      },
    });

    return this.buildFolderTree(folders);
  }

  /**
   * Get folder with its scraps
   */
  async getFolderWithScraps(
    userId: number,
    folderId: number,
  ): Promise<IFolderWithScraps> {
    const folder = await this.findUserFolder(userId, folderId, [
      'scrapFolders.scrap',
    ]);

    const scraps = folder.scrapFolders
      .filter((sf) => !sf.isDeleted && !sf.scrap.isDeleted)
      .sort((a, b) => {
        // Sort by pinned first, then by sort order
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1;
        }
        return a.sortOrder - b.sortOrder;
      })
      .map((sf) => ({
        scrapId: sf.scrap.scrapId,
        title: sf.scrap.title,
        url: sf.scrap.url,
        createdAt: sf.scrap.createdAt,
        isPinned: sf.isPinned,
        sortOrder: sf.sortOrder,
      }));

    return {
      folderId: folder.folderId,
      name: folder.name,
      description: folder.description,
      color: folder.color,
      icon: folder.icon,
      sortOrder: folder.sortOrder,
      isDeleted: folder.isDeleted,
      isSystem: folder.isSystem,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
      deletedAt: folder.deletedAt,
      parentFolderId: folder.parentFolder?.folderId,
      userId: (folder.user as any)?.userId || folder.user,
      scraps,
      scrapCount: scraps.length,
    };
  }

  /**
   * Move scraps to a folder
   */
  async moveScrapsToFolder(
    userId: number,
    moveScrapsDto: MoveScrapsToFolderDto,
  ): Promise<void> {
    const {
      scrapIds,
      folderId,
      notes,
      isPinned = false,
      sortOrder = 0,
    } = moveScrapsDto;

    // Validate folder exists and belongs to user
    const folder = await this.findUserFolder(userId, folderId);

    // Validate scraps exist and belong to user
    const scraps = await this.scrapRepository.find({
      scrapId: { $in: scrapIds },
      user: { userId },
      isDeleted: false,
    });

    if (scraps.length !== scrapIds.length) {
      throw new BadRequestException(
        'Some scraps not found or do not belong to user',
      );
    }

    // Create or update scrap-folder relationships
    for (const scrap of scraps) {
      // Check if relationship already exists
      let scrapFolder = await this.scrapFolderRepository.findOne({
        scrap,
        folder,
      });

      if (scrapFolder) {
        // Update existing relationship
        if (scrapFolder.isDeleted) {
          scrapFolder.restore();
        }
        scrapFolder.notes = notes;
        scrapFolder.isPinned = isPinned;
        scrapFolder.sortOrder = sortOrder;
      } else {
        // Create new relationship
        scrapFolder = new ScrapFolder();
        scrapFolder.scrap = scrap;
        scrapFolder.folder = folder;
        scrapFolder.user = { userId } as any;
        scrapFolder.notes = notes;
        scrapFolder.isPinned = isPinned;
        scrapFolder.sortOrder = sortOrder;

        this.em.persist(scrapFolder);
      }
    }

    await this.em.flush();
  }

  /**
   * Remove scraps from a folder
   */
  async removeScrapsFromFolder(
    userId: number,
    removeScrapsDto: RemoveScrapsFromFolderDto,
  ): Promise<void> {
    const { scrapIds, folderId } = removeScrapsDto;

    const scrapFolders = await this.scrapFolderRepository.find({
      scrap: { scrapId: { $in: scrapIds } },
      folder: { folderId },
      user: { userId },
      isDeleted: false,
    });

    scrapFolders.forEach((sf) => sf.softDelete());
    await this.em.flush();
  }

  /**
   * Get folder statistics for a user
   */
  async getFolderStats(userId: number): Promise<IFolderStats> {
    const folders = await this.folderRepository.find(
      { user: { userId }, isDeleted: false },
      { populate: ['scrapFolders'] },
    );

    const totalFolders = folders.length;
    const totalScraps = folders.reduce(
      (sum, folder) =>
        sum + folder.scrapFolders.filter((sf) => !sf.isDeleted).length,
      0,
    );

    const avgScrapsPerFolder =
      totalFolders > 0 ? totalScraps / totalFolders : 0;
    const deepestLevel = Math.max(...folders.map((f) => f.level), 0);

    // Find most used folder
    const folderUsage = folders.map((folder) => ({
      folderId: folder.folderId,
      name: folder.name,
      scrapCount: folder.scrapFolders.filter((sf) => !sf.isDeleted).length,
    }));

    const mostUsedFolder =
      folderUsage.length > 0
        ? folderUsage.reduce((max, current) =>
            current.scrapCount > max.scrapCount ? current : max,
          )
        : null;

    // Get recently used folders (folders with recent scrap additions)
    const recentlyUsedFolders = await this.scrapFolderRepository.find(
      { user: { userId }, isDeleted: false },
      {
        populate: ['folder'],
        orderBy: { createdAt: QueryOrder.DESC },
        limit: 5,
      },
    );

    const recentlyUsed = recentlyUsedFolders
      .map((sf) => ({
        folderId: sf.folder.folderId,
        name: sf.folder.name,
        lastUsed: sf.createdAt,
      }))
      .filter(
        (folder, index, self) =>
          index === self.findIndex((f) => f.folderId === folder.folderId),
      );

    return {
      totalFolders,
      totalScraps,
      avgScrapsPerFolder: Math.round(avgScrapsPerFolder * 100) / 100,
      deepestLevel,
      mostUsedFolder:
        mostUsedFolder && mostUsedFolder.scrapCount > 0 ? mostUsedFolder : null,
      recentlyUsedFolders: recentlyUsed,
    };
  }

  /**
   * Find a folder that belongs to the specified user
   */
  private async findUserFolder(
    userId: number,
    folderId: number,
    populate?: any,
  ): Promise<Folder> {
    const options: any = {};
    if (populate) {
      options.populate = populate;
    }

    const folder = await this.folderRepository.findOne(
      {
        folderId,
        user: { userId },
        isDeleted: false,
      },
      options,
    );

    if (!folder) {
      throw new FolderNotFoundError(folderId);
    }

    return folder;
  }

  /**
   * Check for name conflicts within the same parent folder
   */
  private async checkNameConflict(
    userId: number,
    name: string,
    parentFolderId?: number,
  ): Promise<void> {
    const existingFolder = await this.folderRepository.findOne({
      user: { userId },
      name,
      parentFolder: parentFolderId ? { folderId: parentFolderId } : null,
      isDeleted: false,
    });

    if (existingFolder) {
      throw new FolderNameConflictError(name);
    }
  }

  /**
   * Check for circular references when moving folders
   */
  private async checkCircularReference(
    folderId: number,
    newParentId: number,
  ): Promise<void> {
    let currentId: number | undefined = newParentId;
    const visited = new Set<number>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);

      if (currentId === folderId) {
        throw new CircularReferenceError();
      }

      const parent = await this.folderRepository.findOne(
        { folderId: currentId },
        { fields: ['parentFolder'] },
      );

      currentId = parent?.parentFolder?.folderId;
    }
  }

  /**
   * Build hierarchical folder tree structure
   */
  private buildFolderTree(folders: Folder[]): IFolderTreeNode[] {
    const folderMap = new Map<number, IFolderTreeNode>();
    const rootFolders: IFolderTreeNode[] = [];

    // Create tree nodes
    folders.forEach((folder) => {
      const node: IFolderTreeNode = {
        folderId: folder.folderId,
        name: folder.name,
        description: folder.description,
        color: folder.color,
        icon: folder.icon,
        sortOrder: folder.sortOrder,
        isDeleted: folder.isDeleted,
        isSystem: folder.isSystem,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
        deletedAt: folder.deletedAt,
        parentFolderId: folder.parentFolder?.folderId,
        userId: folder.user.userId,
        children: [],
        scrapCount: folder.scrapCount,
        level: folder.level,
        fullPath: folder.fullPath,
        hasChildren: folder.hasChildren,
      };

      folderMap.set(folder.folderId, node);
    });

    // Build hierarchy
    folderMap.forEach((node) => {
      if (node.parentFolderId) {
        const parent = folderMap.get(node.parentFolderId);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        rootFolders.push(node);
      }
    });

    // Sort children recursively
    const sortChildren = (nodes: IFolderTreeNode[]) => {
      nodes.sort((a, b) => a.sortOrder - b.sortOrder);
      nodes.forEach((node) => sortChildren(node.children));
    };

    sortChildren(rootFolders);
    return rootFolders;
  }
}
