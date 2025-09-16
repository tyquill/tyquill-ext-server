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
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import { FileAnalysisProducerService } from '../queue/services/file-analysis-producer.service';
import { FileAnalysisMessage } from '../queue/dto/file-analysis.dto';
import { JobStatusService } from '../queue/services/job-status.service';
import { JobStatus } from '../queue/entities/job-status.entity';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
@Injectable()
export class UploadedFilesService {
  private readonly logger = new Logger(UploadedFilesService.name);
  private s3Client: S3Client;
  private bucket: string;
  private readonly ANALYZABLE_MIME_TYPES = new Set([
    'application/pdf',
  ] as const);
  private readonly MAX_JOB_SEARCH_LIMIT = 50;

  constructor(
    private readonly em: EntityManager,
    @InjectRepository(Scrap)
    private readonly scrapRepository: EntityRepository<Scrap>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    private readonly fileAnalysisProducerService: FileAnalysisProducerService,
    private readonly jobStatusService: JobStatusService,
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

  async findAll(userId?: number): Promise<Scrap[]> {
    const where = userId ? { user: { userId } } : {};
    return this.scrapRepository.find(where, {
      populate: ['user', 'tags'],
      orderBy: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number, userId: number): Promise<Scrap> {
    const uploadedFile = await this.scrapRepository.findOne(
      { scrapId: id },
      { populate: ['user', 'tags'] },
    );

    if (!uploadedFile) {
      throw new NotFoundException(`Uploaded item #${id} not found`);
    }

    if (uploadedFile.user.userId !== userId) {
      throw new ForbiddenException(
        'You are not allowed to access this uploaded file',
      );
    }

    return uploadedFile;
  }

  async update(
    id: number,
    updateUploadedFileDto: UpdateUploadedFileDto,
    userId: number,
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

  async remove(id: number, userId: number): Promise<void> {
    const uploadedFile = await this.findOne(id, userId);
    await this.em.removeAndFlush(uploadedFile);
  }

  async getAnalysis(
    id: number,
    userId: number,
  ): Promise<{
    markdown: string | null;
    updatedAt?: Date;
    status?: JobStatus;
    jobUuid?: string;
    error?: string;
  }> {
    const uploaded = await this.findOne(id, userId);

    // Find the latest job for this uploaded file from recent jobs
    let jobUuid: string | undefined;
    let status: JobStatus | undefined;
    let error: string | undefined;
    try {
      const jobs = await this.jobStatusService.getJobsByUser(
        userId,
        this.MAX_JOB_SEARCH_LIMIT,
      );
      const latest = jobs.find(
        (j) => j.payload && j.payload.uploadedFileId === id,
      );
      if (latest) {
        jobUuid = latest.jobUuid;
        status = latest.status;
        error = latest.errorMessage ?? undefined;
      }
    } catch (e) {
      // ignore job lookup failures; return content only
    }

    return {
      markdown: uploaded.aiContent ?? null,
      updatedAt: uploaded.updatedAt ?? uploaded.createdAt,
      status,
      jobUuid,
      error,
    };
  }

  async uploadToS3AndSave(
    file: Express.Multer.File,
    title: string,
    description: string,
    userId: number,
  ): Promise<Scrap> {
    try {
      const user = await this.userRepository.findOne({ userId });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // S3 업로드를 위한 키 생성
      const hashDirectory = createHash('sha512')
        .update(userId.toString())
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

      // PDF 또는 문서 파일인 경우 AI 분석을 큐에 요청
      if (this.shouldAnalyzeFile(file.mimetype)) {
        await this.queueFileAnalysis(uploadedFile, fileUrl);
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

    await this.em.persistAndFlush(scrap);
    return scrap;
  }

  private shouldAnalyzeFile(mimeType: string): boolean {
    return this.ANALYZABLE_MIME_TYPES.has(mimeType as any);
  }

  private async queueFileAnalysis(
    uploadedFile: Scrap,
    fileUrl: string,
  ): Promise<string | null> {
    try {
      this.logger.log(
        `📤 Queuing AI analysis for file: ${uploadedFile.fileName}`,
      );

      const analysisMessage: FileAnalysisMessage = {
        uploadedFileId: uploadedFile.scrapId,
        fileUrl: fileUrl,
        fileName: uploadedFile.fileName!,
        mimeType: uploadedFile.mimeType!,
        userId: uploadedFile.user.userId,
        timestamp: new Date().toISOString(),
      };

      const jobUuid =
        await this.fileAnalysisProducerService.sendFileAnalysisRequest(
          analysisMessage,
        );

      this.logger.log(
        `✅ AI analysis queued for file: ${uploadedFile.fileName} (Job: ${jobUuid})`,
      );
      return jobUuid;
    } catch (error) {
      this.logger.error(
        `❌ Failed to queue analysis for file ${uploadedFile.fileName}:`,
        error,
      );
      // Don't throw - let the file upload succeed even if queueing fails
      return null;
    }
  }

  async retryAnalysis(
    id: number,
    userId: number,
  ): Promise<{ jobUuid: string | null; status: 'queued' | 'error' }> {
    const uploaded = await this.findOne(id, userId);

    try {
      const recentJobs = await this.jobStatusService.getJobsByUser(
        userId,
        this.MAX_JOB_SEARCH_LIMIT,
      );
      const pendingJob = recentJobs.find(
        (j) =>
          j.payload?.uploadedFileId === id &&
          (j.status === JobStatus.PENDING || j.status === JobStatus.PROCESSING),
      );

      if (pendingJob) {
        this.logger.warn(
          `Analysis already in progress for file ${id} (Job: ${pendingJob.jobUuid})`,
        );
        return { jobUuid: pendingJob.jobUuid, status: 'queued' };
      }
    } catch (error) {
      this.logger.error(`❌ Failed to retry analysis for file ${id}:`, error);
    }

    const jobUuid = await this.queueFileAnalysis(uploaded, uploaded.filePath!);
    return { jobUuid, status: jobUuid ? 'queued' : 'error' };
  }
}
