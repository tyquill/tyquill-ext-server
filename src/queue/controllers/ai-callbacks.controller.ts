import { Body, Controller, HttpCode, HttpException, HttpStatus, Post, Req, Version, UsePipes, ValidationPipe } from '@nestjs/common';
import { JobStatusService } from '../services/job-status.service';
import { JobStatus } from '../entities/job-status.entity';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { UploadedFile } from '../../uploaded-files/entities/uploaded-file.entity';
import { IsIn, IsInt, IsString, IsUUID, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';

class FileAnalysisCallbackDto {
  @IsUUID()
  jobUuid!: string;

  @Type(() => Number)
  @IsInt()
  uploadedFileId!: number;

  @IsIn([JobStatus.COMPLETED, JobStatus.FAILED])
  status!: JobStatus;

  @IsOptional()
  @IsString()
  markdown?: string;

  @IsOptional()
  @IsString()
  error?: string;
}

// Note: Global prefix 'api' is already set in main.ts
@Controller('internal/ai-callbacks')
export class AiCallbacksController {
  constructor(
    private readonly jobStatusService: JobStatusService,
    @InjectRepository(UploadedFile)
    private readonly uploadedFileRepo: EntityRepository<UploadedFile>,
  ) {}

  private verifyAgentKey(req: Request) {
    const provided = (req.headers['x-agent-key'] || req.headers['x-tyq-signature']) as string | undefined;
    const expected = process.env.AI_CALLBACK_SECRET;
    
    if (!expected || !provided || provided !== expected) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    const ok = a.length === b.length && timingSafeEqual(a, b);
    if (!ok) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
  }

  @Version('1')
  @Post('file-analysis')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async handleFileAnalysisCallback(
    @Req() req: Request, 
    @Body() body: FileAnalysisCallbackDto
  ): Promise<{ ok: true }> {
    this.verifyAgentKey(req);

    const { jobUuid, uploadedFileId, status, markdown, error } = body;

    if (status === JobStatus.COMPLETED) {
      await this.uploadedFileRepo.getEntityManager().transactional(async (em) => {
        if (markdown && markdown.length > 0) {
          const uploaded = await em.findOne(UploadedFile, { uploadedFileId });
          if (uploaded) {
            uploaded.aiContent = markdown;
            uploaded.updatedAt = new Date();
            await em.flush();
          }
        }
        await this.jobStatusService.updateJobStatus(jobUuid, JobStatus.COMPLETED, {
          result: { uploadedFileId, hasContent: !!markdown },
        });
      });
      return { ok: true };
    }

    if (status === JobStatus.FAILED) {
      await this.uploadedFileRepo.getEntityManager().transactional(async (em) => {
        await this.jobStatusService.updateJobStatus(jobUuid, JobStatus.FAILED, {
            errorMessage: error || 'Unknown error',
          });
      });
      return { ok: true };
    }

    throw new HttpException('Unsupported status', HttpStatus.BAD_REQUEST);
  }
}
