import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
} from 'class-validator';
import { WritingStyleIdentifierLike } from '../../../writing-styles/utils/writing-style-identifier.util';

export class ScrapWithOptionalComment {
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

export class GenerateArticleDto {
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
  scrapWithOptionalComment?: ScrapWithOptionalComment[];

  @ApiProperty()
  @IsString()
  @IsOptional()
  generationParams?: string; // AI 생성 유저 추가 설정 문장

  @ApiProperty()
  @IsArray()
  @IsOptional()
  articleStructureTemplate?: TemplateSectionDto[];

  @ApiProperty({
    description: 'Writing Style ID (UUID or legacy integer)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsOptional()
  writingStyleId?: WritingStyleIdentifierLike;
}

export interface TemplateSectionDto {
  title: string;
  keyIdea: string;
  children?: TemplateSectionDto[];
}

export class GenerateArticleResponse {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiProperty()
  @IsString()
  createdAt: Date;

  @ApiProperty()
  @IsString()
  userId: string;
}
