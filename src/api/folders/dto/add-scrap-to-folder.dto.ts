import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsPositive,
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  Length,
  Min
} from 'class-validator';

export class AddScrapToFolderDto {
  @ApiProperty({
    description: 'Array of scrap IDs to add to folder',
    example: [1, 2, 3],
    type: [Number]
  })
  @IsArray()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  scrapIds: number[];

  @ApiProperty({
    description: 'Notes about why these scraps are in this folder',
    required: false,
    example: 'Research materials for the new feature'
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;

  @ApiProperty({
    description: 'Whether to pin these scraps to the top of the folder',
    required: false,
    example: false
  })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiProperty({
    description: 'Sort order for these scraps within the folder',
    required: false,
    example: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}