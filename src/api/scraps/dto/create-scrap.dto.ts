import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsUrl, MaxLength } from 'class-validator';

export class CreateScrapDto {
  @ApiProperty()
  @IsUrl()
  url: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiProperty({ required: false, description: '스크랩 설명 (요약/메모)' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  userComment?: string;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  articleId?: number;

  @ApiProperty()
  @IsOptional()
  tags?: string[];

  @ApiProperty()
  @IsOptional()
  @IsString()
  htmlContent?: string;
}
