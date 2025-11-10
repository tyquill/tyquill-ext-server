import {
  Controller,
  Get,
  Query,
  UseGuards,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { UserIdParamPipe } from '../../users/pipes/user-id.pipe';

export type AdminUserDashboardResponse = {
  userId: string;
  email: string;
  name: string;
  scrapCount: number;
  articleCount: number;
  inactiveDays: number;
}[];

export type AdminUserDetailResponse = {
  userId: string;
  email: string;
  name: string;
  createdAt: string;
  scrapCount: number;
  articleCount: number;
  scraps: {
    scrapId: string;
    title: string;
    url: string;
    createdAt: string;
  }[];
  articles: {
    articleId: string;
    topic: string;
    keyInsight: string;
    generationStatus: 'processing' | 'completed' | 'failed';
    createdAt: string;
  }[];
};

export type AdminArticleGenerationResultsResponse = {
  userId: string;
  email: string;
  name: string;
  articleId: string;
  topic: string;
  keyInsight: string;
  scrapIds: string[];
  generationParams: Record<string, unknown> | null;
  generationStatus: 'processing' | 'completed' | 'failed';
  createdAt: string;
}[];

export type AdminActivitiesResponse = {
  activityType: string;
  userId: string;
  email: string;
  name: string;
  resourceId: string;
  resourceTitle: string;
  activityDate: string;
}[];

export type AdminArticleDetailResponse = {
  userId: string;
  email: string;
  name: string;
  articleId: string;
  topic: string;
  keyInsight: string;
  generationParams: Record<string, unknown> | null;
  generationStatus: 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  scraps: {
    scrapId: string;
    title: string;
    url: string;
    content: string;
    createdAt: string;
  }[];
  archives: {
    articleArchiveId: string;
    versionNumber: number | null;
    title: string;
    content: string;
    createdAt: string;
  }[];
};

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * 유저 대시보드 - 사용자별 스크랩 수, 생성한 아티클 수, 미활동일 수
   */
  @ApiOkResponse({
    description: 'Aggregated user metrics for the admin dashboard',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          userId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string', example: 'Admin User' },
          scrapCount: { type: 'integer', example: 5 },
          articleCount: { type: 'integer', example: 3 },
          inactiveDays: { type: 'integer', example: 0 },
        },
        required: [
          'userId',
          'email',
          'name',
          'scrapCount',
          'articleCount',
          'inactiveDays',
        ],
      },
    },
  })
  @Get('users/dashboard')
  async getUserDashboard(): Promise<AdminUserDashboardResponse> {
    return this.adminService.getUserDashboard();
  }

  /**
   * 특정 유저의 상세 정보 조회
   */
  @ApiOkResponse({
    description:
      'Detailed information for the requested user, including scraps and articles',
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'integer', example: 1 },
        email: { type: 'string', format: 'email' },
        name: { type: 'string', example: 'Admin User' },
        createdAt: { type: 'string', format: 'date-time' },
        scrapCount: { type: 'integer', example: 10 },
        articleCount: { type: 'integer', example: 4 },
        scraps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              scrapId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
              title: { type: 'string' },
              url: { type: 'string', format: 'uri' },
              createdAt: { type: 'string', format: 'date-time' },
            },
            required: ['scrapId', 'title', 'url', 'createdAt'],
          },
        },
        articles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              articleId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
              topic: { type: 'string' },
              keyInsight: { type: 'string' },
              generationStatus: {
                type: 'string',
                enum: ['processing', 'completed', 'failed'],
              },
              createdAt: { type: 'string', format: 'date-time' },
            },
            required: [
              'articleId',
              'topic',
              'keyInsight',
              'generationStatus',
              'createdAt',
            ],
          },
        },
      },
      required: [
        'userId',
        'email',
        'name',
        'createdAt',
        'scrapCount',
        'articleCount',
        'scraps',
        'articles',
      ],
    },
  })
  @Get('users/detail')
  async getUserDetail(
    @Query('userId', UserIdParamPipe) userId: string,
  ): Promise<AdminUserDetailResponse> {
    return this.adminService.getUserDetail(userId);
  }

  /**
   * 아티클 생성 결과 - 각 아티클 생성 요청별 생성결과
   */
  @ApiOkResponse({
    description: 'Article generation results for recent requests',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          userId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          articleId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
          topic: { type: 'string' },
          keyInsight: { type: 'string' },
          scrapIds: {
            type: 'array',
            items: { type: 'string' },
          },
          generationParams: {
            type: 'object',
            additionalProperties: true,
            nullable: true,
          },
          generationStatus: {
            type: 'string',
            enum: ['processing', 'completed', 'failed'],
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
        required: [
          'userId',
          'email',
          'name',
          'articleId',
          'topic',
          'keyInsight',
          'scrapIds',
          'generationParams',
          'generationStatus',
          'createdAt',
        ],
      },
    },
  })
  @Get('articles/generation-results')
  async getArticleGenerationResults(): Promise<AdminArticleGenerationResultsResponse> {
    return this.adminService.getArticleGenerationResults();
  }

  /**
   * 활동 내역 - 모든 유저들의 활동 내역
   */
  @ApiOkResponse({
    description: 'Activity feed across all users',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          activityType: { type: 'string', example: 'scrap' },
          userId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          resourceId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
          resourceTitle: { type: 'string' },
          activityDate: { type: 'string', format: 'date-time' },
        },
        required: [
          'activityType',
          'userId',
          'email',
          'name',
          'resourceId',
          'resourceTitle',
          'activityDate',
        ],
      },
    },
  })
  @Get('activities')
  async getActivities(
    @Query('userId', UserIdParamPipe) userId?: string,
  ): Promise<AdminActivitiesResponse> {
    return this.adminService.getActivities(userId);
  }

  /**
   * 특정 아티클 생성 요청의 상세 결과
   */
  @ApiOkResponse({
    description: 'Detailed result for a specific article generation request',
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'integer', example: 1 },
        email: { type: 'string', format: 'email' },
        name: { type: 'string' },
        articleId: { type: 'integer', example: 55 },
        topic: { type: 'string' },
        keyInsight: { type: 'string' },
        generationParams: {
          type: 'object',
          additionalProperties: true,
          nullable: true,
        },
        generationStatus: {
          type: 'string',
          enum: ['processing', 'completed', 'failed'],
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        scraps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              scrapId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
              title: { type: 'string' },
              url: { type: 'string', format: 'uri' },
              content: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
            },
            required: ['scrapId', 'title', 'url', 'content', 'createdAt'],
          },
        },
        archives: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              articleArchiveId: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
              versionNumber: {
                type: 'integer',
                nullable: true,
              },
              title: { type: 'string' },
              content: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
            },
            required: [
              'articleArchiveId',
              'versionNumber',
              'title',
              'content',
              'createdAt',
            ],
          },
        },
      },
      required: [
        'userId',
        'email',
        'name',
        'articleId',
        'topic',
        'keyInsight',
        'generationParams',
        'generationStatus',
        'createdAt',
        'updatedAt',
        'scraps',
        'archives',
      ],
    },
  })
  @Get('articles/detail')
  async getArticleDetail(
    @Query('userId', UserIdParamPipe) userId: string,
    @Query('articleId') articleId: string,
  ): Promise<AdminArticleDetailResponse> {
    return this.adminService.getArticleDetail(userId, articleId);
  }

  /**
   * 관리자용 사용자 계정 삭제
   */
  @Delete('users/:userId')
  @Throttle({ default: { limit: 2, ttl: 60000 } }) // 2 requests per 60 seconds
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete user account (Admin only)',
    description:
      'Permanently delete user account and all associated data. Cannot delete admin accounts. Rate limited to 2 requests per minute.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID to delete',
    type: 'string',
  })
  @ApiResponse({
    status: 204,
    description: 'User account successfully deleted',
  })
  @ApiResponse({
    status: 403,
    description: 'Cannot delete admin accounts',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many deletion requests. Please try again later.',
  })
  async deleteUserAccount(
    @Request() req: any,
    @Param('userId', UserIdParamPipe) userId: string,
  ): Promise<void> {
    const adminId = req.user.id;
    await this.adminService.deleteUserAccount(userId, adminId);
  }
}
