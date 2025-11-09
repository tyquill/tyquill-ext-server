import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UserOAuth } from './entities/user-oauth.entity';
import { UserIdParamPipe } from './pipes/user-id.pipe';
// Analytics tracking moved to client; module no longer required here.

@Module({
  imports: [MikroOrmModule.forFeature([User, UserOAuth])],
  providers: [UsersService, UserIdParamPipe],
  exports: [UsersService, UserIdParamPipe],
})
export class UsersModule {}
