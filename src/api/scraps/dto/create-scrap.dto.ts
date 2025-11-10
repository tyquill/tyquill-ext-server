import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsUrl,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class WebpageSiteInfo {
  @IsOptional()
  @IsString()
  host?: string;

  @IsOptional()
  @IsString()
  favicon_url?: string;

  @IsOptional()
  @IsString()
  name?: string;
}

class WebpageMetadata {
  @IsString()
  url: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WebpageSiteInfo)
  site?: WebpageSiteInfo;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;
}

class ContentInfo {
  @IsOptional()
  @IsString()
  raw?: string;

  @IsOptional()
  @IsString()
  plain?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  format?: string;
}

class AuthorInfo {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  picture?: string;
}

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

  @ApiProperty()
  @IsString()
  htmlContent: string;

  @ApiProperty({ required: false, description: '스크랩 설명 (요약/메모)' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  userComment?: string;

  @ApiProperty({
    description: 'Associated article ID (UUID or legacy integer)',
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  articleId?: string;

  @ApiProperty()
  @IsOptional()
  tags?: string[];

  // New metadata fields
  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => WebpageMetadata)
  webpage?: WebpageMetadata;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  hero_image_url?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  published_at?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  author_names?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  author_pictures?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => ContentInfo)
  content_info?: ContentInfo;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AuthorInfo)
  authors?: AuthorInfo[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  from?: string;
}
