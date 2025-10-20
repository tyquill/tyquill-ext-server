import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, Length, Matches } from 'class-validator';

export class CreateFolderDto {
  @ApiProperty({ description: 'Folder name', example: 'My Research' })
  @IsString()
  @Length(1, 255, {
    message: 'Folder name must be between 1 and 255 characters',
  })
  // eslint-disable-next-line no-control-regex
  @Matches(/^[^<>:"/\\|?*\x00-\x1F]+$/, {
    message:
      'Folder name contains invalid characters (no <, >, :, ", /, \\, |, ?, *, or control characters)',
  })
  name: string;

  @ApiProperty({
    description: 'Folder description',
    required: false,
    example: 'Collection of research materials',
  })
  @IsOptional()
  @IsString()
  @Length(0, 1000, { message: 'Description must not exceed 1000 characters' })
  description?: string;

  @ApiProperty({
    description: 'Folder color for UI (hex code)',
    required: false,
    example: '#3B82F6',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'Color must be a valid hex code (e.g., #3B82F6 or #F00)',
  })
  color?: string;

  @ApiProperty({
    description: 'Folder icon name',
    required: false,
    example: 'folder',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100, { message: 'Icon name must be between 1 and 100 characters' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'Icon name can only contain letters, numbers, hyphens, and underscores',
  })
  icon?: string;

  @ApiProperty({
    description: 'Parent folder UUID for nested structure',
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID(4, { message: 'Parent folder ID must be a valid UUID v4' })
  parentFolderId?: string;
}
