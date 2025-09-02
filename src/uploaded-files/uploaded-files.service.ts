import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUploadedFileDto } from '../api/uploaded-files/dto/create-uploaded-file.dto';
import { UpdateUploadedFileDto } from '../api/uploaded-files/dto/update-uploaded-file.dto';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { UploadedFile } from './entities/uploaded-file.entity';
import { User } from '../users/entities/user.entity';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import { Express } from 'express';

@Injectable()
export class UploadedFilesService {
  private s3Client: S3Client;

  constructor(
    private readonly em: EntityManager,
    @InjectRepository(UploadedFile)
    private readonly uploadedFileRepository: EntityRepository<UploadedFile>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
  ) {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  async create(
    createUploadedFileDto: CreateUploadedFileDto & { 
      fileUrl: string; 
      fileName: string; 
      fileSize: number; 
      mimeType: string;
    },
    userId: number,
  ): Promise<UploadedFile> {
    const user = await this.userRepository.findOne({ userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Basic validations and ownership guardrails
    if (!createUploadedFileDto.fileUrl || !createUploadedFileDto.fileName) {
      throw new Error('fileUrl and fileName are required');
    }
    if (createUploadedFileDto.mimeType !== 'application/pdf') {
      throw new Error('Only PDF uploads are allowed');
    }
    if (!/\.pdf$/i.test(createUploadedFileDto.fileName)) {
      throw new Error('File name must end with .pdf');
    }

    // Ensure the URL points to our S3 bucket and proper user namespace
    const bucket = process.env.AWS_S3_BUCKET;
    const region = process.env.AWS_REGION || 'us-east-1';
    try {
      const url = new URL(createUploadedFileDto.fileUrl);
      const expectedHost = `${bucket}.s3.${region}.amazonaws.com`;
      if (url.host !== expectedHost) {
        throw new Error(`fileUrl host mismatch: expected ${expectedHost}`);
      }
      const key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
      const expectedPrefix = `uploads/${userId}/`;
      if (!key.startsWith(expectedPrefix)) {
        throw new Error('fileUrl key must be under your user namespace');
      }
    } catch (e: any) {
      throw new Error(`Invalid fileUrl: ${e.message}`);
    }

    // Idempotency: avoid duplicates by filePath for the same user
    const existing = await this.uploadedFileRepository.findOne({ filePath: createUploadedFileDto.fileUrl, user: { userId } });
    if (existing) {
      return existing;
    }

    const uploadedFile = new UploadedFile();
    uploadedFile.title = createUploadedFileDto.title;
    uploadedFile.description = createUploadedFileDto.description || '';
    uploadedFile.fileName = createUploadedFileDto.fileName;
    uploadedFile.filePath = createUploadedFileDto.fileUrl;
    uploadedFile.mimeType = createUploadedFileDto.mimeType;
    uploadedFile.fileSize = createUploadedFileDto.fileSize;
    uploadedFile.user = user;

    await this.em.persistAndFlush(uploadedFile);
    return uploadedFile;
  }

  async findAll(userId?: number): Promise<UploadedFile[]> {
    const where = userId ? { user: { userId } } : {};
    return this.uploadedFileRepository.find(where, {
      populate: ['user', 'tags'],
      orderBy: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<UploadedFile> {
    const uploadedFile = await this.uploadedFileRepository.findOne(
      { uploadedFileId: id },
      { populate: ['user', 'tags'] },
    );

    if (!uploadedFile) {
      throw new NotFoundException(`UploadedFile #${id} not found`);
    }

    return uploadedFile;
  }

  async update(
    id: number,
    updateUploadedFileDto: UpdateUploadedFileDto,
  ): Promise<UploadedFile> {
    const uploadedFile = await this.findOne(id);

    if (updateUploadedFileDto.title !== undefined) {
      uploadedFile.title = updateUploadedFileDto.title;
    }
    if (updateUploadedFileDto.description !== undefined) {
      uploadedFile.description = updateUploadedFileDto.description;
    }

    await this.em.flush();
    return uploadedFile;
  }

  async remove(id: number): Promise<void> {
    const uploadedFile = await this.findOne(id);
    await this.em.removeAndFlush(uploadedFile);
  }

  async uploadToS3AndSave(
    file: Express.Multer.File,
    title: string,
    description: string,
    userId: number,
  ): Promise<UploadedFile> {
    try {
      const user = await this.userRepository.findOne({ userId });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // S3 업로드를 위한 키 생성
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const fileKey = `uploads/${userId}/${Date.now()}-${safeName}`;
      
      // 파일을 스트림으로 업로드 (메모리 부담 줄이기)
      const tmpPath = (file as any).path as string | undefined;
      const bodyStream = tmpPath ? fs.createReadStream(tmpPath) : undefined;
      const body = bodyStream ?? file.buffer; // fallback to buffer if needed

      const putCommand = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: fileKey,
        Body: body,
        ContentType: file.mimetype,
        ContentLength: file.size,
      });

      await this.s3Client.send(putCommand);

      // S3 URL 생성
      const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${fileKey}`;

      // 데이터베이스에 파일 정보 저장
      const uploadedFile = new UploadedFile();
      uploadedFile.title = title;
      uploadedFile.description = description;
      uploadedFile.fileName = file.originalname;
      uploadedFile.filePath = fileUrl;
      uploadedFile.mimeType = file.mimetype;
      uploadedFile.fileSize = file.size;
      uploadedFile.user = user;

      await this.em.persistAndFlush(uploadedFile);

      // 임시 파일 정리
      if (tmpPath) {
        fs.promises.unlink(tmpPath).catch(() => {});
      }
      return uploadedFile;

    } catch (error) {
      console.error('S3 upload error:', error);
      throw new Error('Failed to upload file to S3');
    }
  }
}
