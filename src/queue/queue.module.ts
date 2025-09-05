import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SqsModule } from '@ssut/nestjs-sqs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { FileAnalysisProducerService } from './services/file-analysis-producer.service';
import { JobStatusService } from './services/job-status.service';
import { JobStatusController } from './controllers/job-status.controller';
import { AiCallbacksController } from './controllers/ai-callbacks.controller';
import { QUEUE_NAMES } from './constants/queue.constants';
import { Job } from './entities/job-status.entity';
import { UploadedFile } from '../uploaded-files/entities/uploaded-file.entity';

@Module({
  imports: [
    ConfigModule,
    MikroOrmModule.forFeature([Job, UploadedFile]),
    SqsModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        return {
          producers: [
            {
              name: QUEUE_NAMES.FILE_ANALYSIS,
              queueUrl: configService.get<string>('AWS_SQS_FILE_ANALYSIS_QUEUE_URL')!,
              region: configService.get<string>('AWS_REGION') || 'us-east-1',
            },
          ],
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [JobStatusController, AiCallbacksController],
  providers: [
    FileAnalysisProducerService,
    JobStatusService,
  ],
  exports: [FileAnalysisProducerService, JobStatusService],
})
export class QueueModule {}
