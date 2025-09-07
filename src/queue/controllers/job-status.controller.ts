import { Controller, Get, Param, Post, Query, UseGuards, Request, Version, BadRequestException } from '@nestjs/common';
import { JobStatusService } from '../services/job-status.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Job } from '../entities/job-status.entity';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobStatusController {
  constructor(private readonly jobStatusService: JobStatusService) {}

  @Version('1')
  @Get('status/:jobUuid')
  async getJobStatus(@Param('jobUuid') jobUuid: string): Promise<Job | null> {
    return this.jobStatusService.getJobStatus(jobUuid);
  }

  @Version('1')
  @Get('my-jobs')
  async getMyJobs(
    @Request() req: any,
    @Query('limit') limit?: string,
  ): Promise<Job[]> {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      throw new BadRequestException('Invalid limit parameter');
    }

    const userId = parseInt(req.user.id);
    if (isNaN(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    return this.jobStatusService.getJobsByUser(userId, limitNum);
  }

  @Version('1')
  @Get('failed')
  async getFailedJobs(@Query('limit') limit?: string): Promise<Job[]> {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      throw new BadRequestException('Invalid limit parameter');
    }
    return this.jobStatusService.getFailedJobs(limitNum);
  }

  @Version('1')
  @Post('retry/:jobUuid')
  async retryJob(@Param('jobUuid') jobUuid: string): Promise<{ success: boolean }> {
    const success = await this.jobStatusService.retryJob(jobUuid);
    return { success };
  }
}