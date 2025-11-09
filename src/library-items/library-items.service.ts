import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Scrap } from '../scraps/entities/scrap.entity';
import { Tag } from '../tags/entities/tag.entity';
import { User } from '../users/entities/user.entity';
import { ScrapsService } from '../scraps/scraps.service';
import { UploadedFilesService } from '../uploaded-files/uploaded-files.service';
import { CreateScrapDto } from '../api/scraps/dto/create-scrap.dto';
import { Express } from 'express';
import {
  UserIdentifierLike,
  buildUserFilterFromInput,
} from '../users/utils/user-identifier.util';

export type LibraryItemType = 'SCRAP' | 'UPLOAD';

export interface LibraryItemDto {
  id: number;
  type: LibraryItemType;
  title: string;
  description?: string;
  previewText?: string;
  url?: string; // scrap.url or uploaded file URL
  mimeType?: string;
  fileSize?: number;
  createdAt: Date;
  updatedAt?: Date;
  tags?: string[];
}

const MAX_PREVIEW_TEXT_LENGTH = 150;
@Injectable()
export class LibraryItemsService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(Scrap)
    private readonly scrapRepository: EntityRepository<Scrap>,
    // Uploaded files are represented as scraps with file metadata
    @InjectRepository(Tag)
    private readonly tagRepository: EntityRepository<Tag>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    private readonly scrapsService: ScrapsService,
    private readonly uploadedFilesService: UploadedFilesService,
  ) {}

  async list(
    userId: UserIdentifierLike,
    type?: LibraryItemType,
  ): Promise<LibraryItemDto[]> {
    const items: LibraryItemDto[] = [];
    const userFilter = buildUserFilterFromInput(userId);

    if (!type || type === 'SCRAP') {
      const scraps = await this.scrapRepository.find(
        { user: userFilter, isDeleted: false },
        { populate: ['tags'], orderBy: { createdAt: 'DESC' } },
      );
      items.push(...scraps.map(this.mapScrapToDto));
    }

    if (!type || type === 'UPLOAD') {
      const uploads = await this.scrapRepository.find(
        {
          user: userFilter,
          filePath: { $ne: null },
          isDeleted: false,
          mimeType: { $ne: null },
        },
        { populate: ['tags'], orderBy: { createdAt: 'DESC' } },
      );
      items.push(...uploads.map(this.mapUploadScrapToDto));
    }

    // 최신순 정렬 (createdAt 기준)
    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createScrap(
    createScrapDto: CreateScrapDto,
    userId: UserIdentifierLike,
  ) {
    return this.scrapsService.create(createScrapDto, userId);
  }

  async uploadViaS3(
    file: Express.Multer.File,
    body: { title?: string; description?: string },
    userId: UserIdentifierLike,
  ) {
    return this.uploadedFilesService.uploadToS3AndSave(
      file,
      body.title || file.originalname.replace(/\.[^/.]+$/, ''),
      body.description || '',
      userId,
    );
  }

  private mapScrapToDto = (s: Scrap): LibraryItemDto => ({
    id: s.scrapId,
    type: 'SCRAP',
    title: s.title,
    description: s.description || s.userComment,
    previewText: s.description
      ? s.description.substring(0, MAX_PREVIEW_TEXT_LENGTH)
      : s.content
        ? s.content.substring(0, MAX_PREVIEW_TEXT_LENGTH)
        : undefined,
    url: s.url,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    tags: s.tags?.getItems()?.map((t) => t.name),
  });

  private mapUploadScrapToDto = (u: Scrap): LibraryItemDto => ({
    id: u.scrapId,
    type: 'UPLOAD',
    title: u.title,
    description: u.description,
    previewText: u.description
      ? u.description.substring(0, MAX_PREVIEW_TEXT_LENGTH)
      : undefined,
    url: u.filePath,
    mimeType: u.mimeType,
    fileSize: u.fileSize,
    createdAt: u.createdAt,
    tags: u.tags?.getItems()?.map((t) => t.name),
  });

  private async findExistingTag(
    em: EntityManager,
    itemId: number,
    itemType: LibraryItemType,
    tagName: string,
    userId: UserIdentifierLike,
  ): Promise<Tag | null> {
    const criteria: any = {
      user: buildUserFilterFromInput(userId),
      name: tagName,
    };

    if (itemType === 'SCRAP') {
      criteria.scrap = { scrapId: itemId };
    } else {
      criteria.scrap = { scrapId: itemId };
    }

    return em.findOne(Tag, criteria);
  }

  // Tag management methods for library items
  async addTag(
    itemId: number,
    itemType: LibraryItemType,
    tagName: string,
    userId: UserIdentifierLike,
  ): Promise<Tag> {
    return this.em.transactional(async (em) => {
      const user = await em.findOne(User, buildUserFilterFromInput(userId));
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if tag already exists for this item
      const existingTag = await this.findExistingTag(
        em,
        itemId,
        itemType,
        tagName,
        userId as number, // legacy support; findExistingTag expects number
      );

      if (existingTag) {
        return existingTag;
      }

      // Create new tag
      const tag = new Tag();
      tag.name = tagName;
      tag.user = user;

      if (itemType === 'SCRAP') {
        const scrap = await em.findOne(Scrap, {
          scrapId: itemId,
          user: buildUserFilterFromInput(userId),
        });
        if (!scrap) {
          throw new NotFoundException('Scrap not found');
        }
        tag.scrap = scrap;
      } else {
        const uploadScrap = await em.findOne(Scrap, {
          scrapId: itemId,
          user: buildUserFilterFromInput(userId),
        });
        if (!uploadScrap) {
          throw new NotFoundException('Uploaded file (as scrap) not found');
        }
        tag.scrap = uploadScrap;
      }

      await em.persistAndFlush(tag);
      return tag;
    });
  }

  async removeTag(
    itemId: number,
    itemType: LibraryItemType,
    tagId: number,
    userId: UserIdentifierLike,
  ): Promise<void> {
    if (itemType === 'SCRAP') {
      const scrap = await this.scrapRepository.findOne({
        scrapId: itemId,
        user: buildUserFilterFromInput(userId),
      });
      if (!scrap) {
        throw new NotFoundException('Scrap not found or access denied');
      }
    } else {
      const uploadedScrap = await this.scrapRepository.findOne({
        scrapId: itemId,
        user: buildUserFilterFromInput(userId),
      });
      if (!uploadedScrap) {
        throw new NotFoundException('Uploaded file not found or access denied');
      }
    }
    let tag: Tag | null = null;

    if (itemType === 'SCRAP') {
      tag = await this.tagRepository.findOne({
        tagId,
        user: buildUserFilterFromInput(userId),
        scrap: { scrapId: itemId },
      });
    } else {
      tag = await this.tagRepository.findOne({
        tagId,
        user: buildUserFilterFromInput(userId),
        scrap: { scrapId: itemId },
      });
    }

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    await this.em.removeAndFlush(tag);
  }

  async getTags(
    itemId: number,
    itemType: LibraryItemType,
    userId: UserIdentifierLike,
  ): Promise<Tag[]> {
    if (itemType === 'SCRAP') {
      return this.tagRepository.find(
        {
          user: buildUserFilterFromInput(userId),
          scrap: { scrapId: itemId },
        },
        {
          populate: ['user', 'scrap'],
          orderBy: { createdAt: 'DESC' },
        },
      );
    } else {
      return this.tagRepository.find(
        {
          user: buildUserFilterFromInput(userId),
          scrap: { scrapId: itemId },
        },
        {
          populate: ['user', 'scrap'],
          orderBy: { createdAt: 'DESC' },
        },
      );
    }
  }
}
