import { IsString, IsOptional, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScrapWithCommentDto {
  @ApiProperty({ description: '스크랩 ID' })
  @IsNumber()
  scrapId: number;

  @ApiPropertyOptional({ description: '사용자 코멘트' })
  @IsOptional()
  @IsString()
  userComment?: string;
}

export class UploadWithUsagePromptDto {
  @ApiProperty({ description: '업로드된 파일 ID' })
  @IsNumber()
  uploadedFileId: number;

  @ApiProperty({ description: '사용 프롬프트 (어떻게 활용할지)', maxLength: 75 })
  @IsString()
  usagePrompt: string;
}

export class GenerateArticleV3Dto {
  @ApiProperty({ description: '아티클 주제' })
  @IsString()
  topic: string;

  @ApiProperty({ description: '키 인사이트/메시지' })
  @IsString()
  keyInsight: string;

  @ApiPropertyOptional({ description: '스크랩과 코멘트 목록' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScrapWithCommentDto)
  scrapWithOptionalComment?: ScrapWithCommentDto[];

  @ApiPropertyOptional({ description: '업로드된 PDF 파일과 사용 프롬프트 목록' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UploadWithUsagePromptDto)
  uploadWithUsagePrompt?: UploadWithUsagePromptDto[];

  @ApiPropertyOptional({ description: '생성 파라미터 (추가 지시사항)' })
  @IsOptional()
  @IsString()
  generationParams?: string;

  @ApiPropertyOptional({ description: '아티클 구조 템플릿' })
  @IsOptional()
  articleStructureTemplate?: any[];

  @ApiPropertyOptional({ description: '문체 스타일 ID' })
  @IsOptional()
  @IsNumber()
  writingStyleId?: number;
}
