import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Folder } from './entities/folder.entity';
import { User } from '../users/entities/user.entity';
import {
  UserIdentifierLike,
  buildUserFilterFromInput,
} from '../users/utils/user-identifier.util';
import {
  ScrapIdentifier,
  isUuid,
} from '../scraps/utils/scrap-identifier.util';
import { Scrap } from '../scraps/entities/scrap.entity';
import { Article } from '../articles/entities/article.entity';
import { FilterQuery } from '@mikro-orm/core';
import { CreateFolderDto } from '../api/folders/dto/create-folder.dto';
import { UpdateFolderDto } from '../api/folders/dto/update-folder.dto';
import {
  FolderResponseDto,
  FolderContentsDto,
} from '../api/folders/dto/folder-response.dto';
import { ArticleIdentifier } from '../articles/utils/article-identifier.util';

@Injectable()
export class FoldersService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(Folder)
    private readonly folderRepository: EntityRepository<Folder>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    @InjectRepository(Scrap)
    private readonly scrapRepository: EntityRepository<Scrap>,
    @InjectRepository(Article)
    private readonly articleRepository: EntityRepository<Article>,
  ) {}

  /**
   * Create a new folder
   */
  async create(
    userId: UserIdentifierLike,
    createFolderDto: CreateFolderDto,
  ): Promise<FolderResponseDto> {
    const user = await this.userRepository.findOne(
      buildUserFilterFromInput(userId),
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if parent folder exists and belongs to user
    if (createFolderDto.parentFolderId) {
      const parentFolder = await this.folderRepository.findOne({
        folderId: createFolderDto.parentFolderId,
        user: buildUserFilterFromInput(userId),
        isDeleted: false,
      });

      if (!parentFolder) {
        throw new NotFoundException('Parent folder not found');
      }
    }

    const folder = new Folder();
    folder.name = createFolderDto.name;
    folder.description = createFolderDto.description;
    folder.color = createFolderDto.color;
    folder.icon = createFolderDto.icon;
    folder.user = user;

    if (createFolderDto.parentFolderId) {
      const parentRef = await this.folderRepository.findOne({
        folderId: createFolderDto.parentFolderId,
      });
      if (parentRef) {
        folder.parentFolder = parentRef;
      }
    }

    await this.em.persistAndFlush(folder);

    return this.toFolderResponseDto(folder);
  }

  /**
   * Find all folders for a user
   * Optionally filter by parent folder (for nested structure)
   */
  async findAll(
    userId: UserIdentifierLike,
    parentFolderId?: string | null,
  ): Promise<FolderResponseDto[]> {
    const query: any = {
      user: buildUserFilterFromInput(userId),
      isDeleted: false,
    };

    // If parentFolderId is explicitly null, find root folders
    if (parentFolderId === null) {
      query.parentFolder = null;
    } else if (parentFolderId) {
      // If parentFolderId is provided, find children of that folder
      query.parentFolder = { folderId: parentFolderId };
    }
    // If parentFolderId is undefined, return all folders

    const folders = await this.folderRepository.find(query, {
      populate: ['childFolders', 'scraps', 'articles'],
      orderBy: { name: 'ASC' },
    });

    return Promise.all(
      folders.map((folder) => this.toFolderResponseDto(folder)),
    );
  }

  /**
   * Find a single folder by ID
   */
  async findOne(
    folderId: string,
    userId: UserIdentifierLike,
  ): Promise<FolderResponseDto> {
    const folder = await this.folderRepository.findOne(
      {
        folderId,
        user: buildUserFilterFromInput(userId),
        isDeleted: false,
      },
      {
        populate: ['childFolders', 'scraps', 'articles', 'parentFolder'],
      },
    );

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    return this.toFolderResponseDto(folder);
  }

  /**
   * Update a folder
   */
  async update(
    folderId: string,
    userId: UserIdentifierLike,
    updateFolderDto: UpdateFolderDto,
  ): Promise<FolderResponseDto> {
    const folder = await this.folderRepository.findOne(
      {
        folderId,
        user: buildUserFilterFromInput(userId),
        isDeleted: false,
      },
      {
        populate: ['parentFolder'],
      },
    );

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    // Check if trying to set parent folder
    if (updateFolderDto.parentFolderId !== undefined) {
      if (updateFolderDto.parentFolderId === null) {
        // Moving to root
        folder.parentFolder = undefined;
      } else if (updateFolderDto.parentFolderId === folderId) {
        throw new BadRequestException('Folder cannot be its own parent');
      } else {
        // Check if parent folder exists and belongs to user
        const parentFolder = await this.folderRepository.findOne({
          folderId: updateFolderDto.parentFolderId,
          user: buildUserFilterFromInput(userId),
          isDeleted: false,
        });

        if (!parentFolder) {
          throw new NotFoundException('Parent folder not found');
        }

        // Check for circular reference
        if (parentFolder.isDescendantOf(folder)) {
          throw new BadRequestException(
            'Cannot move folder to its own descendant',
          );
        }

        folder.parentFolder = parentFolder;
      }
    }

    // Update other fields
    if (updateFolderDto.name !== undefined) {
      folder.name = updateFolderDto.name;
    }
    if (updateFolderDto.description !== undefined) {
      folder.description = updateFolderDto.description;
    }
    if (updateFolderDto.color !== undefined) {
      folder.color = updateFolderDto.color;
    }
    if (updateFolderDto.icon !== undefined) {
      folder.icon = updateFolderDto.icon;
    }

    await this.em.persistAndFlush(folder);

    return this.toFolderResponseDto(folder);
  }

  /**
   * Soft delete a folder
   * CRITICAL FIX: Wrapped in transaction to prevent race conditions
   */
  async remove(folderId: string, userId: UserIdentifierLike): Promise<void> {
    await this.em.transactional(async (em) => {
      // Find folder within transaction
      const folder = await em.findOne(
        Folder,
        {
          folderId,
          user: buildUserFilterFromInput(userId),
          isDeleted: false,
        },
        {
          populate: ['childFolders', 'scraps', 'articles'],
        },
      );

      if (!folder) {
        throw new NotFoundException('Folder not found');
      }

      // Re-check child count inside transaction to prevent race conditions
      const childCount = await em.count(Folder, {
        parentFolder: { folderId },
        isDeleted: false,
      });

      if (childCount > 0) {
        throw new BadRequestException(
          'Cannot delete folder with subfolders. Delete or move subfolders first.',
        );
      }

      // Remove folder reference from all scraps and articles
      const scraps = await em.find(Scrap, {
        folder: { folderId },
        isDeleted: false,
      });
      scraps.forEach((scrap) => {
        scrap.folder = undefined;
      });

      const articles = await em.find(Article, {
        folder: { folderId },
        isDeleted: false,
      });
      articles.forEach((article) => {
        article.folder = undefined;
      });

      // Soft delete the folder
      folder.isDeleted = true;

      // Persist all changes within transaction
      await em.persistAndFlush([folder, ...scraps, ...articles]);
    });
  }

  /**
   * Move scraps and/or articles to a folder
   * CRITICAL FIX: Wrapped in transaction for atomicity
   */
  async moveItemsToFolder(
    folderId: string | null,
    userId: UserIdentifierLike,
    scrapIds?: ScrapIdentifier[],
    articleIds?: ArticleIdentifier[],
  ): Promise<{ movedScraps: number; movedArticles: number }> {
    return await this.em.transactional(async (em) => {
      let targetFolder: Folder | null = null;
      const userFilter = buildUserFilterFromInput(userId);

      // If folderId is provided, verify it exists and belongs to user
      if (folderId) {
        targetFolder = await em.findOne(Folder, {
          folderId,
          user: userFilter as any,
          isDeleted: false,
        });

        if (!targetFolder) {
          throw new NotFoundException('Target folder not found');
        }
      }

      let movedScraps = 0;
      let movedArticles = 0;

      // Move scraps
      if (scrapIds && scrapIds.length > 0) {
        const scraps = await em.find(Scrap, {
          ...this.buildScrapIdFilter(scrapIds),
          user: userFilter as any,
          isDeleted: false,
        });

        scraps.forEach((scrap) => {
          scrap.folder = targetFolder || undefined;
        });

        movedScraps = scraps.length;
        await em.persistAndFlush(scraps);
      }

      // Move articles
      if (articleIds && articleIds.length > 0) {
        const articles = await em.find(Article, {
          articleId: { $in: articleIds },
          user: userFilter as any,
          isDeleted: false,
        });

        articles.forEach((article) => {
          article.folder = targetFolder || undefined;
        });

        movedArticles = articles.length;
        await em.persistAndFlush(articles);
      }

      return { movedScraps, movedArticles };
    });
  }

  /**
   * Get folder contents (scraps, articles, and child folders)
   */
  async getFolderContents(
    folderId: string,
    userId: UserIdentifierLike,
  ): Promise<FolderContentsDto> {
    const folder = await this.folderRepository.findOne(
      {
        folderId,
        user: buildUserFilterFromInput(userId),
        isDeleted: false,
      },
      {
        populate: ['scraps', 'articles', 'childFolders'],
      },
    );

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    // Get scraps with tags populated
    const scraps = await this.scrapRepository.find(
      {
        folder: { folderId },
        isDeleted: false,
      },
      {
        populate: ['tags'],
        orderBy: { createdAt: 'DESC' },
      },
    );

    // Get articles with archives populated
    const articles = await this.articleRepository.find(
      {
        folder: { folderId },
        isDeleted: false,
      },
      {
        populate: ['archives'],
        orderBy: { createdAt: 'DESC' },
      },
    );

    // Get child folders
    const childFolders = await this.folderRepository.find(
      {
        parentFolder: { folderId },
        user: buildUserFilterFromInput(userId),
        isDeleted: false,
      },
      {
        populate: ['childFolders', 'scraps', 'articles'],
        orderBy: { name: 'ASC' },
      },
    );

    return {
      folder: await this.toFolderResponseDto(folder),
      scraps: scraps.map((scrap) => ({
        scrapId: scrap.scrapId,
        url: scrap.url,
        title: scrap.title,
        contentPreview:
          scrap.content && scrap.content.length > 100
            ? scrap.content.substring(0, 100) + '...'
            : scrap.content,
        description: scrap.description,
        heroImageUrl: scrap.heroImageUrl,
        type: scrap.type,
        createdAt: scrap.createdAt,
        updatedAt: scrap.updatedAt,
        tags: scrap.tags.getItems().map((tag) => ({
          tagId: tag.tagId,
          name: tag.name,
        })),
      })),
      articles: articles.map((article) => ({
        articleId: article.articleId,
        topic: article.topic,
        keyInsight: article.keyInsight,
        title: article.getLatestTitle(),
        generationStatus: article.generationStatus,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
      })),
      childFolders: await Promise.all(
        childFolders.map((f) => this.toFolderResponseDto(f)),
      ),
    };
  }

  /**
   * Convert Folder entity to FolderResponseDto
   * CRITICAL FIX: Use count() instead of loadItems() to avoid N+1 queries
   */
  private async toFolderResponseDto(
    folder: Folder,
  ): Promise<FolderResponseDto> {
    // Use count queries instead of loading all items (prevents N+1 and memory issues)
    const scrapCount = await this.em.count(Scrap, {
      folder: { folderId: folder.folderId },
      isDeleted: false,
    });

    const articleCount = await this.em.count(Article, {
      folder: { folderId: folder.folderId },
      isDeleted: false,
    });

    const childFolderCount = await this.em.count(Folder, {
      parentFolder: { folderId: folder.folderId },
      isDeleted: false,
    });

    return {
      folderId: folder.folderId,
      name: folder.name,
      description: folder.description,
      color: folder.color,
      icon: folder.icon,
      parentFolderId: folder.parentFolder?.folderId,
      isDeleted: folder.isDeleted,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
      scrapCount,
      articleCount,
      childFolderCount,
    };
  }

  /**
   * Build a filter query for scrap IDs, handling both UUID and legacy integer IDs
   * @param scrapIds Array of scrap identifiers (UUIDs or legacy integers)
   * @returns FilterQuery for scraps that handles both ID types
   */
  private buildScrapIdFilter(
    scrapIds: ScrapIdentifier[],
  ): FilterQuery<Scrap> {
    if (!scrapIds || scrapIds.length === 0) {
      return { scrapId: { $in: [] } };
    }

    // Separate UUIDs and legacy IDs
    const uuids = scrapIds.filter(
      (id) => typeof id === 'string' && isUuid(id),
    );
    const legacyIds = scrapIds.filter((id) => typeof id === 'number');

    // Build OR condition for both UUID and legacy IDs
    const idConditions: any[] = [];
    if (uuids.length > 0) {
      idConditions.push({ scrapId: { $in: uuids } });
    }
    if (legacyIds.length > 0) {
      idConditions.push({ legacyScrapId: { $in: legacyIds } });
    }

    if (idConditions.length === 0) {
      return { scrapId: { $in: [] } };
    }

    if (idConditions.length === 1) {
      return idConditions[0];
    }

    return { $or: idConditions } as FilterQuery<Scrap>;
  }
}
