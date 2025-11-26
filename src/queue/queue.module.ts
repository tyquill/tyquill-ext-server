import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { JobStatusService } from './services/job-status.service';
import { JobStatusController } from './controllers/job-status.controller';
import { AiCallbacksController } from './controllers/ai-callbacks.controller';
import { Job } from './entities/job-status.entity';
import { Scrap } from '../scraps/entities/scrap.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    ConfigModule,
    MikroOrmModule.forFeature([Job, Scrap]),
    UsersModule,
  ],
  controllers: [JobStatusController, AiCallbacksController],
  providers: [JobStatusService],
  exports: [JobStatusService],
})
export class QueueModule {}