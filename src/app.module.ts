import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { I } from './i/i';
import { ScrapsModule } from './scraps/scraps.module';
import { ScrapsModule } from './scraps/scraps.module';

@Module({
  imports: [ScrapsModule],
  controllers: [AppController],
  providers: [AppService, I],
})
export class AppModule {}
