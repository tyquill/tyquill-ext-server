import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Scrap } from './entities/scrap.entity';
import { ScrapsService } from './scraps.service';
import { ScrapsController } from '../api/scraps/scraps.controller';
import { User } from '../users/entities/user.entity';
import { Article } from '../articles/entities/article.entity';
import { TagsModule } from '../tags/tags.module';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([Scrap, User, Article]),
    TagsModule,
    AgentModule,
  ],
  controllers: [ScrapsController],
  providers: [ScrapsService],
  exports: [ScrapsService],
})
export class ScrapsModule {}
