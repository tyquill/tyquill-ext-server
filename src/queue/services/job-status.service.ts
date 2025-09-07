import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Job, JobType, JobStatus } from '../entities/job-status.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class JobStatusService {
  private readonly logger = new Logger(JobStatusService.name);

  constructor(private readonly em: EntityManager) {}

  async createJob(data: {
    jobType: JobType;
    userId: number;
    payload?: any;
    queueName?: string;
    maxRetries?: number;
  }): Promise<Job> {
    const job = new Job();
    job.jobUuid = uuidv4();
    job.jobType = data.jobType;
    job.userId = data.userId;
    job.payload = data.payload;
    job.queueName = data.queueName;
    job.maxRetries = data.maxRetries ?? 3;
    job.status = JobStatus.PENDING;

    await this.em.persistAndFlush(job);
    
    this.logger.log(`📝 Created job: ${job.jobUuid} (${job.jobType})`);
    return job;
  }

  async updateJobStatus(jobUuid: string, status: JobStatus, data?: {
    result?: any;
    errorMessage?: string;
    sqsMessageId?: string;
    retryCount?: number;
  }): Promise<Job | null> {
    const job = await this.em.findOne(Job, { jobUuid });
    
    if (!job) {
      this.logger.warn(`⚠️ Job not found: ${jobUuid}`);
      return null;
    }

    const currentStatus = job.status;
    
    // Check if the transition is valid
    if (!this.isValidTransition(currentStatus, status)) {
      this.logger.warn(`⚠️ Invalid status transition for job ${jobUuid}: ${currentStatus} -> ${status}. No changes applied.`);
      return job;
    }

    // Handle idempotent case (same status)
    if (currentStatus === status) {
      this.logger.debug(`🔄 Idempotent status update for job ${jobUuid}: ${status} (no change)`);
      // Still apply data updates for idempotent case (e.g., updating result or error message)
      if (data) {
        if (data.result !== undefined) job.result = data.result;
        if (data.errorMessage !== undefined) job.errorMessage = data.errorMessage;
        if (data.sqsMessageId !== undefined) job.sqsMessageId = data.sqsMessageId;
        if (data.retryCount !== undefined) job.retryCount = data.retryCount;
      }
      await this.em.flush();
      return job;
    }

    // Apply status change and related updates
    job.status = status;
    
    if (data) {
      if (data.result !== undefined) job.result = data.result;
      if (data.errorMessage !== undefined) job.errorMessage = data.errorMessage;
      if (data.sqsMessageId !== undefined) job.sqsMessageId = data.sqsMessageId;
      if (data.retryCount !== undefined) job.retryCount = data.retryCount;
    }

    // Update timestamps only for specific transitions
    if ((currentStatus === JobStatus.PENDING || currentStatus === JobStatus.RETRYING) && status === JobStatus.PROCESSING) {
      job.startedAt = new Date();
    }
    if (currentStatus === JobStatus.PROCESSING && (status === JobStatus.COMPLETED || status === JobStatus.FAILED)) {
      job.completedAt = new Date();
    }

    await this.em.flush();
    
    this.logger.log(`📊 Updated job ${jobUuid} status: ${currentStatus} -> ${status}`);
    return job;
  }

  async getJobStatus(jobUuid: string): Promise<Job | null> {
    return this.em.findOne(Job, { jobUuid });
  }

  async getJobsByUser(userId: number, limit: number = 50): Promise<Job[]> {
    return this.em.find(Job, { userId }, {
      orderBy: { createdAt: 'DESC' },
      limit,
    });
  }

  async getFailedJobs(limit: number = 100): Promise<Job[]> {
    return this.em.find(Job, { status: JobStatus.FAILED }, {
      orderBy: { createdAt: 'DESC' },
      limit,
    });
  }

  async retryJob(jobUuid: string): Promise<boolean> {
    const job = await this.em.findOne(Job, { jobUuid });
    
    if (!job || job.status !== JobStatus.FAILED) {
      this.logger.warn(`⚠️ Cannot retry job: ${jobUuid} (not found or not failed)`);
      return false;
    }

    if ((job.retryCount ?? 0) >= (job.maxRetries ?? 3)) {
      this.logger.warn(`⚠️ Job ${jobUuid} has exceeded max retries`);
      return false;
    }

    job.status = JobStatus.RETRYING;
    job.retryCount = (job.retryCount ?? 0) + 1;
    job.errorMessage = undefined;

    await this.em.flush();
    
    this.logger.log(`🔄 Retrying job: ${jobUuid} (attempt ${job.retryCount})`);
    return true;
  }

  /**
   * Validates if a status transition is allowed based on the current and next status.
   * Implements state machine rules for job status transitions.
   * 
   * @param current - Current job status
   * @param next - Requested next status
   * @returns true if transition is valid, false otherwise
   */
  private isValidTransition(current: JobStatus, next: JobStatus): boolean {
    // Same status transitions are always valid (idempotent)
    if (current === next) {
      return true;
    }

    // Define allowed transitions based on state machine rules
    const allowedTransitions: Record<JobStatus, JobStatus[]> = {
      [JobStatus.PENDING]: [JobStatus.PROCESSING, JobStatus.FAILED],
      [JobStatus.PROCESSING]: [JobStatus.COMPLETED, JobStatus.FAILED],
      [JobStatus.RETRYING]: [JobStatus.PROCESSING, JobStatus.FAILED],
      [JobStatus.COMPLETED]: [], // No transitions allowed from completed state
      [JobStatus.FAILED]: [JobStatus.RETRYING], // Only retrying is allowed from failed state
    };

    const validNextStates = allowedTransitions[current] || [];
    return validNextStates.includes(next);
  }
}