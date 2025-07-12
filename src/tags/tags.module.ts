import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Tag } from './entities/tag.entity';
import { TagsService } from './tags.service';
import { User } from '../users/entities/user.entity';
import { Scrap } from '../scraps/entities/scrap.entity';

@Module({
  imports: [MikroOrmModule.forFeature([Tag, User, Scrap])],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}
