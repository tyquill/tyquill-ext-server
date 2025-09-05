import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { LibraryItemsService } from './library-items.service';
import { Scrap } from '../scraps/entities/scrap.entity';
import { UploadedFile } from '../uploaded-files/entities/uploaded-file.entity';
import { Tag } from '../tags/entities/tag.entity';
import { LibraryItemsController } from '../api/library-items/library-items.controller';
import { User } from '../users/entities/user.entity';
import { Article } from '../articles/entities/article.entity';
import { AgentsModule } from '../agents/agents.module';
import { ScrapsModule } from '../scraps/scraps.module';
import { UploadedFilesModule } from '../uploaded-files/uploaded-files.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([Scrap, UploadedFile, Tag, User, Article]),
    AgentsModule,
    ScrapsModule,
    UploadedFilesModule,
  ],
  controllers: [LibraryItemsController],
  providers: [LibraryItemsService],
  exports: [LibraryItemsService],
})
export class LibraryItemsModule {}
