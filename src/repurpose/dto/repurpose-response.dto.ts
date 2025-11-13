import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentFormat, JobStatus } from '../entities';

/**
 * 생성된 콘텐츠 응답 DTO
 */
export class RepurposedContentResponseDto {
  @ApiProperty({
    description: '콘텐츠 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: '콘텐츠 포맷',
    enum: ContentFormat,
    example: ContentFormat.BLOG,
  })
  format: ContentFormat;

  @ApiProperty({
    description: '생성된 콘텐츠',
    example: '# Blog Post Title\n\nContent here...',
  })
  content: string;

  @ApiPropertyOptional({
    description: '포맷별 특화 데이터',
    example: {
      tweets: ['Tweet 1', 'Tweet 2'],
      hashtags: ['ai', 'content'],
    },
  })
  formatSpecificData?: Record<string, any>;

  @ApiProperty({
    description: '품질 점수 (0-100)',
    example: 85,
  })
  qualityScore: number;

  @ApiPropertyOptional({
    description: '품질 평가 세부사항',
    example: {
      clarity: 90,
      relevance: 85,
      engagement: 80,
    },
  })
  qualityDetails?: Record<string, any>;

  @ApiProperty({
    description: '글자 수',
    example: 2500,
  })
  characterCount: number;

  @ApiProperty({
    description: '단어 수',
    example: 450,
  })
  wordCount: number;

  @ApiProperty({
    description: '생성 일시',
    example: '2025-11-13T12:00:00Z',
  })
  createdAt: Date;
}

/**
 * 동기 리퍼포징 응답 DTO
 */
export class RepurposeResponseDto {
  @ApiProperty({
    description: '원본 아티클 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  articleId: string;

  @ApiProperty({
    description: '생성된 콘텐츠 목록',
    type: [RepurposedContentResponseDto],
  })
  contents: RepurposedContentResponseDto[];

  @ApiProperty({
    description: '성공적으로 생성된 포맷 수',
    example: 3,
  })
  successCount: number;

  @ApiProperty({
    description: '실패한 포맷 목록',
    example: ['tiktok'],
  })
  failedFormats: ContentFormat[];

  @ApiProperty({
    description: '전체 처리 시간 (밀리초)',
    example: 15000,
  })
  processingTimeMs: number;
}

/**
 * 비동기 리퍼포징 응답 DTO
 */
export class AsyncRepurposeResponseDto {
  @ApiProperty({
    description: '작업 ID',
    example: 123,
  })
  jobId: number;

  @ApiProperty({
    description: '작업 상태',
    enum: JobStatus,
    example: JobStatus.PENDING,
  })
  status: JobStatus;

  @ApiProperty({
    description: '작업 생성 시각',
    example: '2025-11-13T12:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: '작업 상태 확인 URL',
    example: '/api/v3/repurpose/jobs/123',
  })
  statusUrl: string;
}

/**
 * 작업 상태 조회 응답 DTO
 */
export class JobStatusResponseDto {
  @ApiProperty({
    description: '작업 ID',
    example: 123,
  })
  jobId: number;

  @ApiProperty({
    description: '작업 상태',
    enum: JobStatus,
    example: JobStatus.PROCESSING,
  })
  status: JobStatus;

  @ApiProperty({
    description: '진행률 (0-100)',
    example: 60,
  })
  progress: number;

  @ApiPropertyOptional({
    description: '포맷별 진행률',
    example: {
      blog: 100,
      twitter: 100,
      linkedin: 50,
    },
  })
  formatProgress?: Record<string, number>;

  @ApiPropertyOptional({
    description: '시작 시각',
    example: '2025-11-13T12:00:00Z',
  })
  startedAt?: Date;

  @ApiPropertyOptional({
    description: '완료 시각',
    example: '2025-11-13T12:05:00Z',
  })
  completedAt?: Date;

  @ApiPropertyOptional({
    description: '에러 메시지',
    example: 'Failed to generate TikTok format',
  })
  errorMessage?: string;

  @ApiPropertyOptional({
    description: '작업 결과 (완료 시)',
    type: RepurposeResponseDto,
  })
  result?: RepurposeResponseDto;
}
