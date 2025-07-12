import { IsArray, IsNotEmpty, IsOptional, IsString, IsInt } from 'class-validator';

export class GenerateArticleDto {
  @IsString()
  @IsNotEmpty()
  topic: string;

  @IsString()
  @IsOptional()
  keyInsight?: string;

  @IsArray()
  @IsInt({ each: true })
  scrapIds: number[];

  @IsString()
  @IsOptional()
  userComment?: string;

  @IsString()
  @IsOptional()
  generationParams?: string; // AI 생성 유저 추가 설정 문장
} 