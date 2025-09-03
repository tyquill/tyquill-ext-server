import { Injectable } from '@nestjs/common';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Scrap } from '../scraps/entities/scrap.entity';
import { UploadedFile } from '../uploaded-files/entities/uploaded-file.entity';
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

@Injectable()
export class LibraryItemsService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(Scrap)
    private readonly scrapRepository: EntityRepository<Scrap>,
    @InjectRepository(UploadedFile)
    private readonly uploadedFileRepository: EntityRepository<UploadedFile>,
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
    previewText: s.description ? s.description.substring(0, 150) : (s.content ? s.content.substring(0, 150) : undefined),
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
    previewText: u.description ? u.description.substring(0, 150) : undefined,
    url: u.filePath,
    mimeType: u.mimeType,
    fileSize: u.fileSize,
    createdAt: u.createdAt,
    tags: u.tags?.getItems()?.map(t => t.name),
  });
}
