import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
// import { CreateUploadedFileDto } from '../api/uploaded-files/dto/create-uploaded-file.dto';
import { UpdateUploadedFileDto } from '../api/uploaded-files/dto/update-uploaded-file.dto';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Scrap } from '../scraps/entities/scrap.entity';
import { User } from '../users/entities/user.entity';
import {
  UserIdentifierLike,
  buildUserFilterFromInput,
  ensureUserIdentifier,
  normalizeUserIdentifier,
} from '../users/utils/user-identifier.util';
import {
  normalizeScrapIdentifier,
  buildScrapFilterFromInput,
} from '../scraps/utils/scrap-identifier.util';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
@Injectable()
export class UploadedFilesService {
  private readonly logger = new Logger(UploadedFilesService.name);
  private s3Client: S3Client;
  private bucket: string;

  constructor(
    private readonly em: EntityManager,
    @InjectRepository(Scrap)
    private readonly scrapRepository: EntityRepository<Scrap>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
  ) {
    this.bucket = process.env.AWS_S3_BUCKET || '';
    if (this.bucket === '') {
      throw new Error('AWS_S3_BUCKET is not set');
    }

    const region = process.env.AWS_REGION || 'us-east-1';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';
    if (accessKeyId === '' || secretAccessKey === '') {
      throw new Error('AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY is not set');
    }

    this.s3Client = new S3Client({
      region: region,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });
  }

  // metadata-only create() was removed in favor of server-proxy upload flow

  async findAll(userId?: UserIdentifierLike): Promise<Scrap[]> {
    const normalized = normalizeUserIdentifier(userId);
    const where =
      normalized !== undefined
        ? { user: buildUserFilterFromInput(normalized), isDeleted: false }
        : {};
    return this.scrapRepository.find(where, {
      populate: ['user', 'tags'],
      orderBy: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: UserIdentifierLike): Promise<Scrap> {
    // Support both UUID and legacy numeric IDs
    const scrapFilter = buildScrapFilterFromInput(normalizeScrapIdentifier(id));

    const uploadedFile = await this.scrapRepository.findOne(
      scrapFilter,
      { populate: ['user', 'tags'] },
    );

    if (!uploadedFile) {
      throw new NotFoundException(`Uploaded item #${id} not found`);
    }

    const normalizedUserId = ensureUserIdentifier(userId);
    if (
      (typeof normalizedUserId === 'string' &&
        uploadedFile.user.userId !== normalizedUserId) ||
      (typeof normalizedUserId === 'number' &&
        uploadedFile.user.legacyUserId !== normalizedUserId)
    ) {
      throw new ForbiddenException(
        'You are not allowed to access this uploaded file',
      );
    }

    return uploadedFile;
  }

  async update(
    id: string,
    updateUploadedFileDto: UpdateUploadedFileDto,
    userId: UserIdentifierLike,
  ): Promise<Scrap> {
    const uploadedFile = await this.findOne(id, userId);

    if (updateUploadedFileDto.title !== undefined) {
      uploadedFile.title = updateUploadedFileDto.title;
    }
    if (updateUploadedFileDto.description !== undefined) {
      uploadedFile.description = updateUploadedFileDto.description;
    }

    await this.em.flush();
    return uploadedFile;
  }

  async remove(id: string, userId: UserIdentifierLike): Promise<void> {
    const uploadedFile = await this.findOne(id, userId);
    await this.em.removeAndFlush(uploadedFile);
  }

  async uploadToS3AndSave(
    file: Express.Multer.File,
    title: string,
    description: string,
    userId: UserIdentifierLike,
  ): Promise<Scrap> {
    try {
      const user = await this.userRepository.findOne(
        buildUserFilterFromInput(userId),
      );
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // S3 업로드를 위한 키 생성
      const hashDirectory = createHash('sha512')
        .update(String(user.userId))
        .digest('hex')
        .substring(0, 8);
      const fileKey = `uploads/${hashDirectory}/${uuidv4()}`;

      // 파일을 스트림으로 업로드 (메모리 부담 줄이기)
      const tmpPath = (file as any).path as string | undefined;
      const bodyStream = tmpPath ? fs.createReadStream(tmpPath) : undefined;
      const body = bodyStream ?? file.buffer; // fallback to buffer if needed

      const putCommand = new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
        Body: body,
        ContentType: file.mimetype,
        ContentLength: file.size,
      });

      await this.s3Client.send(putCommand);

      // S3 URL 생성
      const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${fileKey}`;

      // 데이터베이스에 파일 정보 저장 (공통 로직 사용)
      const uploadedFile = await this.persistScrapUpload({
        user,
        title,
        description,
        fileName: file.originalname,
        filePath: fileUrl,
        mimeType: file.mimetype,
        fileSize: file.size,
      });

      // 임시 파일 정리
      if (tmpPath) {
        fs.promises.unlink(tmpPath).catch((error) => {
          console.warn('Failed to delete temporary file: ${tmpPath}', error);
        });
      }
      return uploadedFile;
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new InternalServerErrorException('Failed to upload file to S3');
    }
  }

  private async persistScrapUpload(params: {
    user: User;
    title: string;
    description: string;
    fileName: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
  }): Promise<Scrap> {
    // Idempotency by (user, filePath)
    const existing = await this.scrapRepository.findOne({
      filePath: params.filePath,
      user: { userId: params.user.userId },
    });
    if (existing) return existing;

    const scrap = new Scrap();
    scrap.title = params.title;
    scrap.description = params.description || '';
    scrap.fileName = params.fileName;
    scrap.filePath = params.filePath;
    scrap.mimeType = params.mimeType;
    scrap.fileSize = params.fileSize;
    scrap.user = params.user;
    // For uploads, set url to file path and blank content/html
    scrap.url = params.filePath;
    scrap.content = '';
    scrap.htmlContent = '';

    // Set type based on mimeType
    if (params.mimeType === 'application/pdf') {
      scrap.type = 'pdf';
    } else if (params.mimeType?.startsWith('image/')) {
      scrap.type = 'image';
    } else if (params.mimeType?.startsWith('video/')) {
      scrap.type = 'video';
    } else if (params.mimeType?.startsWith('audio/')) {
      scrap.type = 'audio';
    } else {
      scrap.type = 'upload';
    }
    scrap.from = 'extension';

    await this.em.persistAndFlush(scrap);
    return scrap;
  }
}
