import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { LibraryItemsService } from './library-items.service';
import { Scrap } from '../scraps/entities/scrap.entity';
import { UploadedFile } from '../uploaded-files/entities/uploaded-file.entity';
import { Tag } from '../tags/entities/tag.entity';
import { LibraryItemsController } from '../api/library-items/library-items.controller';
import { ScrapsService } from '../scraps/scraps.service';
import { UploadedFilesService } from '../uploaded-files/uploaded-files.service';
import { User } from '../users/entities/user.entity';
import { Article } from '../articles/entities/article.entity';

@Module({
  imports: [
    MikroOrmModule.forFeature([Scrap, UploadedFile, Tag, User, Article]),
  ],
  controllers: [LibraryItemsController],
  providers: [LibraryItemsService, ScrapsService, UploadedFilesService],
  exports: [LibraryItemsService],
})
export class LibraryItemsModule {}

