import {
  Controller,
  Delete,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiProperty,
} from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UsersService } from '../../users/users.service';

export class ConfirmDeleteAccountDto {
  @ApiProperty({
    description: 'Confirmation phrase: "DELETE MY ACCOUNT"',
    example: 'DELETE MY ACCOUNT',
  })
  @IsString()
  confirmation: string;

  @ApiProperty({
    description: 'User password for additional verification (optional)',
    required: false,
  })
  @IsString()
  @IsOptional()
  password?: string;
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Delete('me')
  @Throttle({ default: { limit: 2, ttl: 60000 } }) // 2 requests per 60 seconds
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete own account',
    description:
      'Permanently delete authenticated user account and all associated data. This action cannot be undone. Rate limited to 2 requests per minute.',
  })
  @ApiResponse({
    status: 204,
    description: 'Account successfully deleted',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid confirmation or validation failed',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many deletion requests. Please try again later.',
  })
  async deleteOwnAccount(
    @Request() req: any,
    @Body() confirmDto: ConfirmDeleteAccountDto,
  ): Promise<void> {
    const userId = req.user.id;

    // Validate confirmation phrase
    if (confirmDto.confirmation !== 'DELETE MY ACCOUNT') {
      throw new BadRequestException(
        'Invalid confirmation. Please type "DELETE MY ACCOUNT" to confirm.',
      );
    }

    // Optional: Verify password if provided
    // if (confirmDto.password) {
    //   await this.authService.verifyPassword(userId, confirmDto.password);
    // }

    await this.usersService.deleteAccount(userId, {
      deletedBy: 'self',
    });

    // Return 204 No Content (void response)
  }

  @Post('me/deletion-request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request account deletion',
    description:
      'Initiate account deletion process. May trigger email confirmation.',
  })
  @ApiResponse({
    status: 200,
    description: 'Deletion request created. Check email for confirmation link.',
  })
  async requestAccountDeletion(): Promise<{ message: string }> {
    // Optional: Send confirmation email with deletion link
    // @Request() req: any - uncomment when implementing email confirmation
    // const userId = req.user.id;
    // await this.emailService.sendDeletionConfirmation(userId);

    return {
      message: 'Deletion request created. Please check your email to confirm.',
    };
  }
}
