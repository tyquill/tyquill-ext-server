import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';
import { SectionTemplate } from 'src/types/section-template';

export class ScrapWithOptionalComment {
  @ApiProperty()
  @IsNumber()
  scrapId: number;

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
  articleStructureTemplate?: SectionTemplate[];
} 

export class GenerateArticleResponse {
  @ApiProperty()
  @IsNumber()
  id: number;

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
  @IsNumber()
  userId: number;
}