import { Injectable, Logger } from '@nestjs/common';
import { SqsService } from '@ssut/nestjs-sqs';
import { FileAnalysisMessage, FileAnalysisRequestDto } from '../dto/file-analysis.dto';
import { QUEUE_NAMES, MESSAGE_TYPES } from '../constants/queue.constants';
import { JobStatusService } from './job-status.service';
import { JobType, JobStatus } from '../entities/job-status.entity';

@Injectable()
export class FileAnalysisProducerService {
  private readonly logger = new Logger(FileAnalysisProducerService.name);

  constructor(
    private readonly sqsService: SqsService,
    private readonly jobStatusService: JobStatusService,
  ) {}

  async sendFileAnalysisRequest(data: FileAnalysisMessage): Promise<string> {
    let job: any = null;
    
    try {
      const message = new FileAnalysisRequestDto(data);
      
      // Create job tracking record
      job = await this.jobStatusService.createJob({
        jobType: JobType.FILE_ANALYSIS,
        userId: data.userId,
        payload: {
          uploadedFileId: data.uploadedFileId,
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          mimeType: data.mimeType,
        },
        queueName: QUEUE_NAMES.FILE_ANALYSIS,
      });
      
      this.logger.log(`📤 Sending file analysis request to queue for file: ${data.fileName}`);
      
      const result = await this.sqsService.send(QUEUE_NAMES.FILE_ANALYSIS, {
        id: `file-analysis-${data.uploadedFileId}-${Date.now()}`,
        body: {
          type: MESSAGE_TYPES.FILE_ANALYSIS_REQUEST,
          jobUuid: job.jobUuid,
          data: message,
        },
        messageAttributes: {
          messageType: {
            StringValue: MESSAGE_TYPES.FILE_ANALYSIS_REQUEST,
            DataType: 'String',
          },
          jobUuid: {
            StringValue: job.jobUuid,
            DataType: 'String',
          },
          uploadedFileId: {
            StringValue: data.uploadedFileId.toString(),
            DataType: 'String',
          },
          userId: {
            StringValue: data.userId.toString(),
            DataType: 'String',
          },
        },
        groupId: `file-analysis-${data.userId}`, // For FIFO queue
        deduplicationId: `${job.jobUuid}-${Date.now()}`, // For FIFO queue
      });

      // Update job with actual SQS MessageId if available
      try {
        const batchResults = Array.isArray(result) ? result : [];
        const messageId = batchResults.length > 0 ? batchResults[0].MessageId : undefined;
        await this.jobStatusService.updateJobStatus(job.jobUuid, JobStatus.PENDING, {
          sqsMessageId: messageId || 'sent-to-queue',
        });
      } catch (e) {
        this.logger.warn(`⚠️ Unable to record SQS MessageId for Job ${job.jobUuid}: ${e}`);
      }

      this.logger.log(`✅ File analysis request sent successfully for file: ${data.fileName} (Job: ${job.jobUuid})`);
      return job.jobUuid;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Failed to send file analysis request for file: ${data.fileName}`, error);
      
      // If job was created, mark it as FAILED before rethrowing
      if (job && job.jobUuid) {
        try {
          await this.jobStatusService.updateJobStatus(job.jobUuid, JobStatus.FAILED, {
            errorMessage: `Failed to send to queue: ${errorMessage}`,
          });
          this.logger.log(`🚨 Marked job ${job.jobUuid} as FAILED due to queue send error`);
        } catch (updateError) {
          this.logger.error(`❌ Failed to update job status to FAILED for job ${job.jobUuid}`, updateError);
        }
      }
      
      throw error;
    }
  }
}
