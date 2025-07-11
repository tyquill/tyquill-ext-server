import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import mikroOrmConfig from './mikro-orm.config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ScrapsModule } from './scraps/scraps.module';

@Module({
  imports: [
    MikroOrmModule.forRoot(mikroOrmConfig),
    ScrapsModule,    
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
