import { PartialType } from '@nestjs/mapped-types';
import { CreateScrapDto } from './create-scrap.dto';
import { IsOptional, IsString, MaxLength, IsUrl } from 'class-validator';

export class UpdateScrapDto extends PartialType(CreateScrapDto) {
  @IsOptional()
  @IsUrl()
  @MaxLength(2000)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  htmlContent?: string;

  @IsOptional()
  @IsString()
  userComment?: string;
}
