import { Module } from '@nestjs/common';
import { TagsService } from './tags.service';
import { TagsController } from '../api/tags/tags.controller';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Tag } from './entities/tag.entity';

@Module({
  imports: [MikroOrmModule.forFeature([Tag])],
  controllers: [TagsController],
  providers: [TagsService],
})
export class TagsModule {}
