import { ApiProperty } from '@nestjs/swagger';

export class FolderResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  folderId: string;

  @ApiProperty({ example: 'My Research' })
  name: string;

  @ApiProperty({ example: 'Collection of research materials', nullable: true })
  description?: string;

  @ApiProperty({ example: '#3B82F6', nullable: true })
  color?: string;

  @ApiProperty({ example: 'folder', nullable: true })
  icon?: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  parentFolderId?: string;

  @ApiProperty({ example: false })
  isDeleted: boolean;

  @ApiProperty({ example: '2025-10-19T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-10-19T00:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ type: 'number', example: 5 })
  scrapCount?: number;

  @ApiProperty({ type: 'number', example: 2 })
  articleCount?: number;

  @ApiProperty({ type: 'number', example: 3 })
  childFolderCount?: number;
}

export class FolderContentsDto {
  @ApiProperty({ type: FolderResponseDto })
  folder: FolderResponseDto;

  @ApiProperty({ type: 'array', description: 'Scraps in this folder' })
  scraps: any[];

  @ApiProperty({ type: 'array', description: 'Articles in this folder' })
  articles: any[];

  @ApiProperty({ type: [FolderResponseDto], description: 'Child folders' })
  childFolders: FolderResponseDto[];
}
