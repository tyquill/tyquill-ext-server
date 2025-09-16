import { Controller, Get, Query } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * 유저 대시보드 - 사용자별 스크랩 수, 생성한 아티클 수, 미활동일 수
   */
  @Get('users/dashboard')
  async getUserDashboard() {
    return this.adminService.getUserDashboard();
  }

  /**
   * 특정 유저의 상세 정보 조회
   */
  @Get('users/detail')
  async getUserDetail(@Query('userId') userId: number) {
    return this.adminService.getUserDetail(userId);
  }

  /**
   * 아티클 생성 결과 - 각 아티클 생성 요청별 생성결과
   */
  @Get('articles/generation-results')
  async getArticleGenerationResults() {
    return this.adminService.getArticleGenerationResults();
  }

  /**
   * 활동 내역 - 모든 유저들의 활동 내역
   */
  @Get('activities')
  async getActivities(@Query('userId') userId?: number) {
    return this.adminService.getActivities(userId);
  }

  /**
   * 특정 아티클 생성 요청의 상세 결과
   */
  @Get('articles/detail')
  async getArticleDetail(
    @Query('userId') userId: number,
    @Query('articleId') articleId: number,
  ) {
    return this.adminService.getArticleDetail(userId, articleId);
  }
}
