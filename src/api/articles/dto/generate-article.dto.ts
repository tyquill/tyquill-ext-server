import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsInt } from 'class-validator';

export class GenerateArticleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  topic: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  keyInsight?: string;

  @ApiProperty()
  @IsArray()
  @IsInt({ each: true })
  scrapIds: number[];

  @ApiProperty()
  @IsString()
  @IsOptional()
  userComment?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  generationParams?: string; // AI 생성 유저 추가 설정 문장
} 