import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RepurposeService } from './services/repurpose.service';
import {
  RepurposeRequestDto,
  RepurposeResponseDto,
  AsyncRepurposeResponseDto,
  JobStatusResponseDto,
} from './dto';

@ApiTags('Content Repurposing')
@Controller('v3/content/repurpose')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RepurposeController {
  constructor(private readonly repurposeService: RepurposeService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '멀티포맷 콘텐츠 리퍼포징',
    description:
      '원본 아티클을 여러 플랫폼 포맷으로 변환합니다. async=true인 경우 비동기 처리, false인 경우 동기 처리됩니다.',
  })
  @ApiResponse({
    status: 200,
    description: '동기 처리 완료 (async=false)',
    type: RepurposeResponseDto,
  })
  @ApiResponse({
    status: 202,
    description: '비동기 작업 시작 (async=true)',
    type: AsyncRepurposeResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Article not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request',
  })
  async repurpose(
    @Request() req: any,
    @Body() request: RepurposeRequestDto,
  ): Promise<RepurposeResponseDto | AsyncRepurposeResponseDto> {
    const userId = req.user.id;

    // 비동기 처리
    if (request.async) {
      return this.repurposeService.repurposeAsync(userId, request);
    }

    // 동기 처리
    return this.repurposeService.repurpose(userId, request);
  }

  @Get('jobs/:jobId')
  @ApiOperation({
    summary: '리퍼포징 작업 상태 조회',
    description: '비동기 리퍼포징 작업의 진행 상태를 확인합니다.',
  })
  @ApiParam({
    name: 'jobId',
    description: '작업 UUID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: '작업 상태 조회 성공',
    type: JobStatusResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found',
  })
  async getJobStatus(
    @Param('jobId') jobId: string,
  ): Promise<JobStatusResponseDto> {
    return this.repurposeService.getJobStatus(jobId);
  }

  @Get('articles/:articleId')
  @ApiOperation({
    summary: '아티클의 모든 리퍼포징 콘텐츠 조회',
    description: '특정 아티클에 대해 생성된 모든 리퍼포징 콘텐츠를 조회합니다.',
  })
  @ApiParam({
    name: 'articleId',
    description: 'Article UUID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: '리퍼포징 콘텐츠 목록 조회 성공',
    type: [RepurposeResponseDto],
  })
  async getArticleRepurposedContent(
    @Param('articleId') articleId: string,
  ): Promise<RepurposeResponseDto> {
    return this.repurposeService.getArticleRepurposedContent(articleId);
  }

  @Get(':id')
  @ApiOperation({
    summary: '리퍼포징 콘텐츠 상세 조회',
    description: '특정 리퍼포징 콘텐츠의 상세 정보를 조회합니다.',
  })
  @ApiParam({
    name: 'id',
    description: 'Repurposed Content UUID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: '콘텐츠 상세 조회 성공',
  })
  async getRepurposedContent(@Param('id') id: string) {
    return this.repurposeService.getRepurposedContent(id);
  }
}
