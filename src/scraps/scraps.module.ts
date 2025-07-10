import { Module } from '@nestjs/common';
import { ScrapsService } from './scraps.service';
import { ScrapsController } from './scraps.controller';

@Module({
  controllers: [ScrapsController],
  providers: [ScrapsService],
})
export class ScrapsModule {}
