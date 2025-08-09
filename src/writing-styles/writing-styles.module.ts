import { Module } from '@nestjs/common';
import { WritingStylesController } from '../api/writing-styles/writing-styles.controller'; // 경로 수정
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { WritingStyle } from './entities/writing-style.entity';
import { WritingStylesService } from './writing-styles.service';
import { WritingStyleExample } from './entities/writing-style-example.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [MikroOrmModule.forFeature([WritingStyle, WritingStyleExample, User])],
  controllers: [WritingStylesController],
  providers: [WritingStylesService],
  exports: [WritingStylesService],
})
export class WritingStylesModule {}
