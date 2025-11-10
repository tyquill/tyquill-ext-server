import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
} from 'class-validator';
import { WritingStyleIdentifierLike } from '../../../writing-styles/utils/writing-style-identifier.util';

export class ScrapWithOptionalCommentV2 {
  @ApiProperty({
    description: 'Scrap ID (UUID or legacy integer)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  scrapId: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  userComment?: string;
}

export class GenerateArticleV2Dto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  topic: string;

  @ApiProperty()
  @IsString()
  keyInsight: string;

  @ApiProperty()
  @IsArray()
  @IsOptional()
  scrapWithOptionalComment?: ScrapWithOptionalCommentV2[];

  @ApiProperty()
  @IsString()
  @IsOptional()
  generationParams?: string; // AI 생성 유저 추가 설정 문장

  @ApiProperty()
  @IsArray()
  @IsOptional()
  articleStructureTemplate?: TemplateSectionV2Dto[];

  @ApiProperty({
    description: 'Writing Style ID (UUID or legacy integer)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsOptional()
  writingStyleId?: WritingStyleIdentifierLike;
}

export interface TemplateSectionV2Dto {
  title: string;
  keyIdea: string;
  children?: TemplateSectionV2Dto[];
}

/**
 * V2 API 비동기 생성 응답 - 즉시 202 반환
 */
export class GenerateArticleV2Response {
  @ApiProperty({
    description: 'Article ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  articleId: string;

  @ApiProperty()
  @IsString()
  status: 'processing' | 'completed' | 'failed';

  @ApiProperty()
  @IsString()
  message: string;

  @ApiProperty()
  @IsString()
  createdAt: Date;
}

/**
 * V2 API 상태 확인 응답
 */
export class ArticleStatusV2Response {
  @ApiProperty({
    description: 'Article ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  articleId: string;

  @ApiProperty()
  @IsString()
  status: 'processing' | 'completed' | 'failed';

  @ApiProperty()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  content?: string;

  @ApiProperty()
  @IsString()
  createdAt: Date;
}
