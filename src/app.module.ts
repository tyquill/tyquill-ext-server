import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScrapsModule } from './scraps/scraps.module';

@Module({
  imports: [ScrapsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
