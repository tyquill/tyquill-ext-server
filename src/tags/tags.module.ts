import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Tag } from './entities/tag.entity';
import { TagsService } from './tags.service';
import { TagsController } from '../api/tags/tags.controller';
import { User } from '../users/entities/user.entity';
import { Scrap } from '../scraps/entities/scrap.entity';

@Module({
  imports: [MikroOrmModule.forFeature([Tag, User, Scrap])],
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}
