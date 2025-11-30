import { ApiProperty } from '@nestjs/swagger';

/**
 * 보고서 생성 응답 DTO
 */
export class ReportResponseDto {
  @ApiProperty({
    description: '생성된 아티클 ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  articleId: string;

  @ApiProperty({
    description: '보고서 내용 (Markdown)',
    example: '# 주간 업무 보고서\n\n## 주요 성과\n...',
  })
  content: string;

  @ApiProperty({
    description: '보고서 주제',
    example: '주간 업무 보고서 (11월 1일 ~ 11월 5일)',
  })
  topic: string;

  @ApiProperty({
    description: '생성 상태',
    enum: ['completed', 'failed'],
    example: 'completed',
  })
  generationStatus: 'completed' | 'failed';

  @ApiProperty({
    description: '생성 일시',
    example: '2025-11-05T05:00:00Z',
  })
  createdAt: Date;
}
