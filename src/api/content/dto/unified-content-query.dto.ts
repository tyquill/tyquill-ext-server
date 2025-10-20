import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsArray,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum ContentType {
  SCRAP = 'scrap',
  ARTICLE = 'article',
  ALL = 'all',
}

export enum ScrapSubType {
  WEBCLIP = 'webclip',
  UPLOAD = 'upload',
}

export enum SortByField {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  TITLE = 'title',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class UnifiedContentQueryDto {
  @ApiPropertyOptional({
    description:
      'Filter by folder ID (null for root items, omit for all items)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  folderId?: string | null;

  @ApiPropertyOptional({
    description: 'Filter by content type',
    enum: ContentType,
    default: ContentType.ALL,
  })
  @IsOptional()
  @IsEnum(ContentType)
  type?: ContentType = ContentType.ALL;

  @ApiPropertyOptional({
    description: 'Sub-filter for scraps only (webclip or upload)',
    enum: ScrapSubType,
  })
  @IsOptional()
  @IsEnum(ScrapSubType)
  scrapType?: ScrapSubType;

  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: SortByField,
    default: SortByField.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(SortByField)
  sortBy?: SortByField = SortByField.CREATED_AT;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: SortOrder,
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({
    description: 'Search query (searches in title and content)',
    example: 'typescript tutorial',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description:
      'Filter by tag names (OR logic - items with any of these tags)',
    type: [String],
    example: ['javascript', 'tutorial'],
  })
  @IsOptional()
  @Transform(({ value }) => {
    // Handle both single string and array
    if (typeof value === 'string') {
      return [value];
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
