import { Body, Controller, HttpCode, HttpException, HttpStatus, Post, Req, Version } from '@nestjs/common';
import { JobStatusService } from '../services/job-status.service';
import { JobStatus } from '../entities/job-status.entity';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { UploadedFile } from '../../uploaded-files/entities/uploaded-file.entity';

interface FileAnalysisCallbackBody {
  jobUuid: string;
  uploadedFileId: number;
  status: 'COMPLETED' | 'FAILED';
  markdown?: string;
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

  private verifyAgentKey(req: any) {
    const provided = (req.headers['x-agent-key'] || req.headers['x-tyq-signature']) as string | undefined;
    const expected = process.env.AI_CALLBACK_SECRET;
    if (!expected || !provided || provided !== expected) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
  }

  @Version('1')
  @Post('file-analysis')
  @HttpCode(HttpStatus.OK)
  async handleFileAnalysisCallback(@Req() req: any, @Body() body: FileAnalysisCallbackBody) {
    this.verifyAgentKey(req);

    const { jobUuid, uploadedFileId, status, markdown, error } = body;
    if (!jobUuid || !uploadedFileId || !status) {
      throw new HttpException('Invalid payload', HttpStatus.BAD_REQUEST);
    }

    if (status === 'COMPLETED') {
      if (markdown && markdown.length > 0) {
        const uploaded = await this.uploadedFileRepo.findOne({ uploadedFileId });
        if (uploaded) {
          uploaded.aiContent = markdown;
          uploaded.updatedAt = new Date();
          await this.uploadedFileRepo.getEntityManager().flush();
        }
      }
      await this.jobStatusService.updateJobStatus(jobUuid, JobStatus.COMPLETED, {
        result: { uploadedFileId, hasContent: !!markdown },
      });
      return { ok: true };
    }

    if (status === 'FAILED') {
      await this.jobStatusService.updateJobStatus(jobUuid, JobStatus.FAILED, {
        errorMessage: error || 'Unknown error',
      });
      return { ok: true };
    }

    throw new HttpException('Unsupported status', HttpStatus.BAD_REQUEST);
  }
}
