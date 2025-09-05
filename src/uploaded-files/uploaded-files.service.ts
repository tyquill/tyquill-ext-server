import { ForbiddenException, Injectable, InternalServerErrorException, NotFoundException, Logger } from '@nestjs/common';
// import { CreateUploadedFileDto } from '../api/uploaded-files/dto/create-uploaded-file.dto';
import { UpdateUploadedFileDto } from '../api/uploaded-files/dto/update-uploaded-file.dto';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { UploadedFile } from './entities/uploaded-file.entity';
import { User } from '../users/entities/user.entity';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import { FileAnalysisAgentService } from '../agents/services/file-analysis-agent.service';
@Injectable()
export class UploadedFilesService {
  private readonly logger = new Logger(UploadedFilesService.name);
  private s3Client: S3Client;
  private bucket: string;
  private readonly ANALYZABLE_MIME_TYPES = new Set(['application/pdf'] as const);  

  constructor(
    private readonly em: EntityManager,
    @InjectRepository(UploadedFile)
    private readonly uploadedFileRepository: EntityRepository<UploadedFile>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    private readonly fileAnalysisAgentService: FileAnalysisAgentService,
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

  async findAll(userId?: number): Promise<UploadedFile[]> {
    const where = userId ? { user: { userId } } : {};
    return this.uploadedFileRepository.find(where, {
      populate: ['user', 'tags'],
      orderBy: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number, userId: number): Promise<UploadedFile> {
    const uploadedFile = await this.uploadedFileRepository.findOne(
      { uploadedFileId: id },
      { populate: ['user', 'tags'] },
    );

    if (!uploadedFile) {
      throw new NotFoundException(`UploadedFile #${id} not found`);
    }

    if (uploadedFile.user.userId !== userId) {
      throw new ForbiddenException('You are not allowed to access this uploaded file');
    }

    return uploadedFile;
  }

  async update(
    id: number,
    updateUploadedFileDto: UpdateUploadedFileDto,
    userId: number,
  ): Promise<UploadedFile> {
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

  async remove(id: number, userId: number): Promise<void> {
    const uploadedFile = await this.findOne(id, userId);
    await this.em.removeAndFlush(uploadedFile);
  }

  async getAnalysis(id: number, userId: number): Promise<{ markdown: string | null; updatedAt?: Date }> {
    const uploaded = await this.findOne(id, userId);
    return { 
      markdown: uploaded.aiContent ?? null, 
      updatedAt: uploaded.createdAt,
    };
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
      const uploadedFile = await this.persistUploadedFile({
        user,
        title,
        description,
        fileName: file.originalname,
        filePath: fileUrl,
        mimeType: file.mimetype,
        fileSize: file.size,
      });

      // PDF 또는 문서 파일인 경우 AI 분석 수행
      if (this.shouldAnalyzeFile(file.mimetype)) {
        this.analyzeFileInBackground(uploadedFile, fileUrl);
      }

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

  private async persistUploadedFile(params: {
    user: User;
    title: string;
    description: string;
    fileName: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
  }): Promise<UploadedFile> {
    // Idempotency by (user, filePath)
    const existing = await this.uploadedFileRepository.findOne({ filePath: params.filePath, user: { userId: params.user.userId } });
    if (existing) return existing;

    const uploadedFile = new UploadedFile();
    uploadedFile.title = params.title;
    uploadedFile.description = params.description || '';
    uploadedFile.fileName = params.fileName;
    uploadedFile.filePath = params.filePath;
    uploadedFile.mimeType = params.mimeType;
    uploadedFile.fileSize = params.fileSize;
    uploadedFile.user = params.user;

    await this.em.persistAndFlush(uploadedFile);
    return uploadedFile;
  }

  private shouldAnalyzeFile(mimeType: string): boolean {
    return this.ANALYZABLE_MIME_TYPES.has(mimeType as any);
  }

  private async analyzeFileInBackground(uploadedFile: UploadedFile, fileUrl: string): Promise<void> {
    try {
      this.logger.log(`🔍 Starting AI analysis for file: ${uploadedFile.fileName}`);

      const analysisResult = await this.fileAnalysisAgentService.analyzeFile(
        fileUrl
      );

      // Update the uploaded file with AI analysis
      uploadedFile.aiContent = analysisResult;
      await this.em.flush();

      this.logger.log(`✅ AI analysis completed for file: ${uploadedFile.fileName}`);
    } catch (error) {
      this.logger.error(`❌ Failed to analyze file ${uploadedFile.fileName}:`, error);
      // Don't throw - let the file upload succeed even if analysis fails
    }
  }
}
