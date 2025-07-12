import { IsString, IsOptional, IsNumber, IsUrl, MaxLength } from 'class-validator';

export class CreateScrapDto {
  @IsUrl()
  @MaxLength(2000)
  url: string;

  @IsString()
  @MaxLength(500)
  title: string;

  @IsString()
  content: string; // 텍스트 추출된 내용

  @IsString()
  htmlContent: string; // 전체 HTML 내용

  @IsOptional()
  @IsString()
  userComment?: string;

  @IsOptional()
  @IsNumber()
  articleId?: number;
}
