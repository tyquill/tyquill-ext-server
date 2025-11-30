import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UserOAuth } from './entities/user-oauth.entity';
import { UserIdParamPipe } from './pipes/user-id.pipe';
import { UsersController } from '../api/users/users.controller';
import { AccountDeletionAudit } from './entities/account-deletion-audit.entity';
import { PendingS3Deletion } from './entities/pending-s3-deletion.entity';
// Analytics tracking moved to client; module no longer required here.

@Module({
  imports: [
    MikroOrmModule.forFeature([
      User,
      UserOAuth,
      AccountDeletionAudit,
      PendingS3Deletion,
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, UserIdParamPipe],
  exports: [UsersService, UserIdParamPipe],
})
export class UsersModule {}
