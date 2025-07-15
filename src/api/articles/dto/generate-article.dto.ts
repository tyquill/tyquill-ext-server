import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsInt, IsNumber } from 'class-validator';

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
} 