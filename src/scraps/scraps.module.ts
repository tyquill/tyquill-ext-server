import { Module } from '@nestjs/common';
import { ScrapsService } from './scraps.service';
import { ScrapsController } from '../api/scraps/scraps.controller';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Scrap } from './entities/scrap.entity';

@Module({
  imports: [MikroOrmModule.forFeature([Scrap])],
  controllers: [ScrapsController],
  providers: [ScrapsService],
})
export class ScrapsModule {}
