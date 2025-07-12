import { IsString, IsOptional, IsNumber, IsUrl, MaxLength } from 'class-validator';

export class CreateScrapDto {
  @IsUrl()
  @MaxLength(2000)
  url: string;

  @IsString()
  @MaxLength(500)
  title: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  userComment?: string;

  @IsOptional()
  @IsNumber()
  articleId?: number;
}
