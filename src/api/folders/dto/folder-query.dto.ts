import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  Length,
  Min,
  Max,
  IsPositive,
  IsIn,
} from 'class-validator';

export class FolderQueryDto {
  @ApiProperty({
    description: 'Search term for folder names and descriptions',
    required: false,
    example: 'project',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;

  @ApiProperty({
    description: 'Include deleted folders in results',
    required: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  includeDeleted?: boolean;

  @ApiProperty({
    description: 'Include system folders in results',
    required: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  includeSystem?: boolean;

  @ApiProperty({
    description: 'Parent folder ID to filter by (omit for root folders)',
    required: false,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  parentId?: number;

  @ApiProperty({
    description: 'Field to sort by',
    required: false,
    enum: ['name', 'createdAt', 'updatedAt', 'sortOrder'],
    example: 'sortOrder',
  })
  @IsOptional()
  @IsString()
  @IsIn(['name', 'createdAt', 'updatedAt', 'sortOrder'])
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'sortOrder';

  @ApiProperty({
    description: 'Sort order direction',
    required: false,
    enum: ['asc', 'desc'],
    example: 'asc',
  })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiProperty({
    description: 'Maximum number of results to return',
    required: false,
    minimum: 1,
    maximum: 100,
    example: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({
    description: 'Number of results to skip',
    required: false,
    minimum: 0,
    example: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
