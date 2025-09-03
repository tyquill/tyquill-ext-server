import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Scrap } from '../scraps/entities/scrap.entity';
import { UploadedFile } from '../uploaded-files/entities/uploaded-file.entity';
import { Tag } from '../tags/entities/tag.entity';
import { User } from '../users/entities/user.entity';
import { ScrapsService } from '../scraps/scraps.service';
import { UploadedFilesService } from '../uploaded-files/uploaded-files.service';
import { CreateScrapDto } from '../api/scraps/dto/create-scrap.dto';
import { Express } from 'express';

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
    @InjectRepository(UploadedFile)
    private readonly uploadedFileRepository: EntityRepository<UploadedFile>,
    @InjectRepository(Tag)
    private readonly tagRepository: EntityRepository<Tag>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    private readonly scrapsService: ScrapsService,
    private readonly uploadedFilesService: UploadedFilesService,
  ) {}

  async list(userId: number, type?: LibraryItemType): Promise<LibraryItemDto[]> {
    const items: LibraryItemDto[] = [];

    if (!type || type === 'SCRAP') {
      const scraps = await this.scrapRepository.find(
        { user: { userId }, isDeleted: false },
        { populate: ['tags'], orderBy: { createdAt: 'DESC' } },
      );
      items.push(...scraps.map(this.mapScrapToDto));
    }

    if (!type || type === 'UPLOAD') {
      const uploads = await this.uploadedFileRepository.find(
        { user: { userId } },
        { populate: ['tags'], orderBy: { createdAt: 'DESC' } },
      );
      items.push(...uploads.map(this.mapUploadToDto));
    }

    // 최신순 정렬 (createdAt 기준)
    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createScrap(createScrapDto: CreateScrapDto, userId: number) {
    return this.scrapsService.create(createScrapDto, userId);
  }

  async uploadViaS3(
    file: Express.Multer.File,
    body: { title?: string; description?: string },
    userId: number,
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
    previewText: s.description ? s.description.substring(0, MAX_PREVIEW_TEXT_LENGTH) : (s.content ? s.content.substring(0, MAX_PREVIEW_TEXT_LENGTH) : undefined),
    url: s.url,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    tags: s.tags?.getItems()?.map(t => t.name),
  });

  private mapUploadToDto = (u: UploadedFile): LibraryItemDto => ({
    id: u.uploadedFileId,
    type: 'UPLOAD',
    title: u.title,
    description: u.description,
    previewText: u.description ? u.description.substring(0, MAX_PREVIEW_TEXT_LENGTH) : undefined,
    url: u.filePath,
    mimeType: u.mimeType,
    fileSize: u.fileSize,
    createdAt: u.createdAt,
    tags: u.tags?.getItems()?.map(t => t.name),
  });

  // Tag management methods for library items
  async addTag(itemId: number, itemType: LibraryItemType, tagName: string, userId: number): Promise<Tag> {
    return this.em.transactional(async (em) => {
    const user = await em.findOne(User, { userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if tag already exists for this item
    let existingTag: Tag | null = null;
    if (itemType === 'SCRAP') {
      existingTag = await em.findOne(Tag, {
        user: { userId },
        scrap: { scrapId: itemId },
        name: tagName,
      });
    } else {
      existingTag = await em.findOne(Tag, {
        user: { userId },
        uploadedFile: { uploadedFileId: itemId },
        name: tagName,
      });
    }

    if (existingTag) {
      return existingTag;
    }

    // Create new tag
    const tag = new Tag();
    tag.name = tagName;
    tag.user = user;

    if (itemType === 'SCRAP') {
      const scrap = await em.findOne(Scrap, { scrapId: itemId, user: { userId } });
      if (!scrap) {
        throw new NotFoundException('Scrap not found');
      }
      tag.scrap = scrap;
    } else {
      const uploadedFile = await em.findOne(UploadedFile, { uploadedFileId: itemId, user: { userId } });
      if (!uploadedFile) {
        throw new NotFoundException('Uploaded file not found');
      }
      tag.uploadedFile = uploadedFile;
    }

    await em.persistAndFlush(tag);
      return tag;
    });
  }

  async removeTag(itemId: number, itemType: LibraryItemType, tagId: number, userId: number): Promise<void> {
    let tag: Tag | null = null;
    
    if (itemType === 'SCRAP') {
      tag = await this.tagRepository.findOne({
        tagId,
        user: { userId },
        scrap: { scrapId: itemId },
      });
    } else {
      tag = await this.tagRepository.findOne({
        tagId,
        user: { userId },
        uploadedFile: { uploadedFileId: itemId },
      });
    }

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    await this.em.removeAndFlush(tag);
  }

  async getTags(itemId: number, itemType: LibraryItemType, userId: number): Promise<Tag[]> {
    if (itemType === 'SCRAP') {
      return this.tagRepository.find({
        user: { userId },
        scrap: { scrapId: itemId },
      });
    } else {
      return this.tagRepository.find({
        user: { userId },
        uploadedFile: { uploadedFileId: itemId },
      });
    }
  }
}
