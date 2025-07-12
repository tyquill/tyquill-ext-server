import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Scrap } from './entities/scrap.entity';
import { ScrapsService } from './scraps.service';
import { User } from '../users/entities/user.entity';
import { Article } from '../articles/entities/article.entity';
import { ScrapsController } from '../api/scraps/scraps.controller';

@Module({
  imports: [MikroOrmModule.forFeature([Scrap, User, Article])],
  providers: [ScrapsService],
  exports: [ScrapsService],
  controllers: [ScrapsController],
})
export class ScrapsModule {}
