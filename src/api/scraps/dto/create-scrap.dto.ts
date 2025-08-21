import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsUrl, MaxLength } from 'class-validator';

export class CreateScrapDto {
  @ApiProperty()
  @IsUrl()
  @MaxLength(2000)
  url: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  content: string;

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
