import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsHexColor,
  Length,
  Min,
  Max,
  IsInt,
  IsPositive,
} from 'class-validator';

export class CreateFolderDto {
  @ApiProperty({ description: 'Folder name', example: 'Project Documents' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiProperty({
    description: 'Folder description',
    required: false,
    example: 'Documents related to the current project',
  })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @ApiProperty({
    description: 'Hex color code for folder',
    required: false,
    example: '#FF5733',
  })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiProperty({
    description: 'Icon identifier for folder',
    required: false,
    example: 'folder',
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  icon?: string;

  @ApiProperty({
    description: 'Sort order for folder',
    required: false,
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999999)
  sortOrder?: number;

  @ApiProperty({
    description: 'Parent folder ID',
    required: false,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  parentFolderId?: number;
}
