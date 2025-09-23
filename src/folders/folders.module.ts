import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { FolderService } from './services/folder.service';
import { FoldersController } from '../api/folders/folders.controller';
import { Folder } from './entities/folder.entity';
import { ScrapFolder } from './entities/scrap-folder.entity';
import { Scrap } from '../scraps/entities/scrap.entity';

@Module({
  imports: [
    MikroOrmModule.forFeature([Folder, ScrapFolder, Scrap]),
  ],
  controllers: [FoldersController],
  providers: [
    FolderService,
  ],
  exports: [
    FolderService,
  ],
})
export class FoldersModule {}