import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Folder } from './entities/folder.entity';
import { FoldersService } from './folders.service';
import { FoldersController } from '../api/folders/folders.controller';
import { User } from '../users/entities/user.entity';
import { Scrap } from '../scraps/entities/scrap.entity';
import { Article } from '../articles/entities/article.entity';

@Module({
  imports: [MikroOrmModule.forFeature([Folder, User, Scrap, Article])],
  controllers: [FoldersController],
  providers: [FoldersService],
  exports: [FoldersService],
})
export class FoldersModule {}
