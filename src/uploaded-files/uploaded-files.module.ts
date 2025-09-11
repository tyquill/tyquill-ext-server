import { Module, forwardRef } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { UploadedFilesService } from './uploaded-files.service';
import { UploadedFilesController } from '../api/uploaded-files/uploaded-files.controller';
import { Scrap } from '../scraps/entities/scrap.entity';
import { User } from '../users/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { AgentsModule } from '../agents/agents.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([Scrap, User]),
    AuthModule,
    AgentsModule,
    forwardRef(() => QueueModule), // Use forwardRef to avoid circular dependency
  ],
  controllers: [UploadedFilesController],
  providers: [UploadedFilesService],
  exports: [UploadedFilesService],
})
export class UploadedFilesModule {}
