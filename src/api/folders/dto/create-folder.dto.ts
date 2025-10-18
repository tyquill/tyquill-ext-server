import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateFolderDto {
  @ApiProperty({ description: 'Folder name', example: 'My Research' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Folder description',
    required: false,
    example: 'Collection of research materials',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Folder color for UI (hex code)',
    required: false,
    example: '#3B82F6',
  })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({
    description: 'Folder icon name',
    required: false,
    example: 'folder',
  })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({
    description: 'Parent folder UUID for nested structure',
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  parentFolderId?: string;
}
