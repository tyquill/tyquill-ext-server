import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsUrl, MaxLength } from 'class-validator';

export class CreateScrapDto {
  @ApiProperty()
  @IsUrl()
  @MaxLength(2000)
  url: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  title: string;

  @ApiProperty()
  @IsString()
  htmlContent: string; // 전체 HTML 내용 (프론트엔드에서 전송)

  @ApiProperty()
  @IsOptional()
  @IsString()
  userComment?: string;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  articleId?: number;
}
