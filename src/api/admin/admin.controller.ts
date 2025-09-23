import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';

export type AdminUserDashboardResponse = {
  userId: number;
  email: string;
  name: string;
  scrapCount: number;
  articleCount: number;
  inactiveDays: number;
}[];

export type AdminUserDetailResponse = {
  userId: number;
  email: string;
  name: string;
  createdAt: string;
  scrapCount: number;
  articleCount: number;
  scraps: {
    scrapId: number;
    title: string;
    url: string;
    createdAt: string;
  }[];
  articles: {
    articleId: number;
    topic: string;
    keyInsight: string;
    generationStatus: 'processing' | 'completed' | 'failed';
    createdAt: string;
  }[];
};

export type AdminArticleGenerationResultsResponse = {
  userId: number;
  email: string;
  name: string;
  articleId: number;
  topic: string;
  keyInsight: string;
  scrapIds: number[];
  generationParams: Record<string, unknown> | null;
  generationStatus: 'processing' | 'completed' | 'failed';
  createdAt: string;
}[];

export type AdminActivitiesResponse = {
  activityType: string;
  userId: number;
  email: string;
  name: string;
  resourceId: number;
  resourceTitle: string;
  activityDate: string;
}[];

export type AdminArticleDetailResponse = {
  userId: number;
  email: string;
  name: string;
  articleId: number;
  topic: string;
  keyInsight: string;
  generationParams: Record<string, unknown> | null;
  generationStatus: 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  scraps: {
    scrapId: number;
    title: string;
    url: string;
    content: string;
    createdAt: string;
  }[];
  archives: {
    articleArchiveId: number;
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
          userId: { type: 'integer', example: 1 },
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
              scrapId: { type: 'integer', example: 1 },
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
              articleId: { type: 'integer', example: 1 },
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
    @Query('userId') userId: number,
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
          userId: { type: 'integer', example: 1 },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          articleId: { type: 'integer', example: 42 },
          topic: { type: 'string' },
          keyInsight: { type: 'string' },
          scrapIds: {
            type: 'array',
            items: { type: 'integer' },
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
          userId: { type: 'integer', example: 1 },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          resourceId: { type: 'integer', example: 101 },
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
    @Query('userId') userId?: number,
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
              scrapId: { type: 'integer', example: 10 },
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
              articleArchiveId: { type: 'integer', example: 20 },
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
    @Query('userId') userId: number,
    @Query('articleId') articleId: number,
  ): Promise<AdminArticleDetailResponse> {
    return this.adminService.getArticleDetail(userId, articleId);
  }
}
