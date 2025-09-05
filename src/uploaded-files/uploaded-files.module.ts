import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { UploadedFilesService } from './uploaded-files.service';
import { UploadedFilesController } from '../api/uploaded-files/uploaded-files.controller';
import { UploadedFile } from './entities/uploaded-file.entity';
import { User } from '../users/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([UploadedFile, User]),
    AuthModule,
    AgentsModule,
  ],
  controllers: [UploadedFilesController],
  providers: [UploadedFilesService],
  exports: [UploadedFilesService],
})
export class UploadedFilesModule {}
