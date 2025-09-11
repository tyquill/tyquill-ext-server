import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UserOAuth } from './entities/user-oauth.entity';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [MikroOrmModule.forFeature([User, UserOAuth]), AnalyticsModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {} 
