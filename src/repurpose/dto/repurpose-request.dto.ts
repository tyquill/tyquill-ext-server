import {
  IsUUID,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentFormat } from '../entities';

/**
 * 포맷별 세부 옵션
 */
export class FormatOptionsDto {
  @ApiPropertyOptional({
    description: '대상 청중',
    example: 'developers, marketers, general audience',
  })
  @IsOptional()
  @IsString()
  targetAudience?: string;

  @ApiPropertyOptional({
    description: '핵심 메시지',
    example: 'AI-powered content repurposing saves time',
  })
  @IsOptional()
  @IsString()
  keyMessage?: string;

  @ApiPropertyOptional({
    description: '전문적 맥락 (LinkedIn용)',
    example: 'B2B SaaS marketing',
  })
  @IsOptional()
  @IsString()
  professionalContext?: string;

  @ApiPropertyOptional({
    description: '비주얼 맥락 (Instagram용)',
    example: 'workspace setup, productivity tools',
  })
  @IsOptional()
  @IsString()
  visualContext?: string;

  @ApiPropertyOptional({
    description: '채널 스타일 (YouTube용)',
    example: 'educational, tutorial-based',
  })
  @IsOptional()
  @IsString()
  channelStyle?: string;

  @ApiPropertyOptional({
    description: '팟캐스트 스타일',
    example: 'conversational, interview-style',
  })
  @IsOptional()
  @IsString()
  podcastStyle?: string;

  @ApiPropertyOptional({
    description: '호스트 성격',
    example: 'friendly, enthusiastic',
  })
  @IsOptional()
  @IsString()
  hostPersonality?: string;

  @ApiPropertyOptional({
    description: '청중 세그먼트 (Email용)',
    example: 'premium subscribers',
  })
  @IsOptional()
  @IsString()
  audienceSegment?: string;

  @ApiPropertyOptional({
    description: '글자 수 제한',
    example: 2000,
  })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(10000)
  characterLimit?: number;

  @ApiPropertyOptional({
    description: '톤 & 스타일',
    example: 'professional, casual, humorous',
  })
  @IsOptional()
  @IsString()
  tone?: string;
}

/**
 * 멀티포맷 리퍼포징 요청 DTO
 */
export class RepurposeRequestDto {
  @ApiProperty({
    description: '원본 아티클 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  articleId: string;

  @ApiProperty({
    description: '생성할 콘텐츠 포맷 목록',
    enum: ContentFormat,
    isArray: true,
    example: [ContentFormat.BLOG, ContentFormat.TWITTER, ContentFormat.LINKEDIN],
  })
  @IsArray()
  @IsEnum(ContentFormat, { each: true })
  formats: ContentFormat[];

  @ApiPropertyOptional({
    description: '포맷별 옵션 (key: ContentFormat, value: FormatOptionsDto)',
    example: {
      blog: { targetAudience: 'developers', characterLimit: 2000 },
      twitter: { keyMessage: 'AI saves time', tone: 'casual' },
    },
  })
  @IsOptional()
  formatOptions?: Record<ContentFormat, FormatOptionsDto>;

  @ApiPropertyOptional({
    description: '사용자 정의 템플릿 UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional({
    description: '비동기 처리 여부 (true: 백그라운드 작업, false: 동기 처리)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  async?: boolean;

  @ApiPropertyOptional({
    description: '품질 점수 임계값 (이 점수 미만이면 재생성)',
    example: 70,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  qualityThreshold?: number;
}
