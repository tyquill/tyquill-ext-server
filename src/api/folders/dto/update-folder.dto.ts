import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsHexColor,
  Length,
  Min,
  Max,
  IsInt,
  IsPositive
} from 'class-validator';

export class UpdateFolderDto {
  @ApiProperty({
    description: 'Folder name',
    required: false,
    example: 'Updated Project Documents'
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiProperty({
    description: 'Folder description',
    required: false,
    example: 'Updated description for the folder'
  })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @ApiProperty({
    description: 'Hex color code for folder',
    required: false,
    example: '#3366FF'
  })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiProperty({
    description: 'Icon identifier for folder',
    required: false,
    example: 'project'
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  icon?: string;

  @ApiProperty({
    description: 'Sort order for folder',
    required: false,
    example: 20
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999999)
  sortOrder?: number;

  @ApiProperty({
    description: 'Parent folder ID (null to move to root)',
    required: false,
    example: 2
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  parentFolderId?: number;

  @ApiProperty({
    description: 'Whether folder is deleted (for soft delete/restore)',
    required: false,
    example: false
  })
  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;
}