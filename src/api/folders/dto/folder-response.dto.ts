import { ApiProperty } from '@nestjs/swagger';

export class FolderResponseDto {
  @ApiProperty({ description: 'Folder ID', example: 1 })
  folderId: number;

  @ApiProperty({ description: 'Folder name', example: 'Project Documents' })
  name: string;

  @ApiProperty({
    description: 'Folder description',
    required: false,
    example: 'Documents related to the current project',
  })
  description?: string;

  @ApiProperty({
    description: 'Hex color code',
    required: false,
    example: '#FF5733',
  })
  color?: string;

  @ApiProperty({
    description: 'Icon identifier',
    required: false,
    example: 'folder',
  })
  icon?: string;

  @ApiProperty({ description: 'Sort order', example: 10 })
  sortOrder: number;

  @ApiProperty({ description: 'Whether folder is deleted', example: false })
  isDeleted: boolean;

  @ApiProperty({
    description: 'Whether folder is system-generated',
    example: false,
  })
  isSystem: boolean;

  @ApiProperty({
    description: 'Creation date',
    example: '2023-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update date',
    example: '2023-01-01T00:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Deletion date',
    required: false,
    example: '2023-01-01T00:00:00Z',
  })
  deletedAt?: Date;

  @ApiProperty({
    description: 'Parent folder ID',
    required: false,
    example: 1,
  })
  parentFolderId?: number;

  @ApiProperty({ description: 'Owner user ID', example: 1 })
  userId: number;
}

export class FolderTreeNodeDto extends FolderResponseDto {
  @ApiProperty({
    description: 'Child folders',
    type: [FolderTreeNodeDto],
    example: [],
  })
  children: FolderTreeNodeDto[];

  @ApiProperty({ description: 'Number of scraps in folder', example: 5 })
  scrapCount: number;

  @ApiProperty({ description: 'Folder depth level', example: 0 })
  level: number;

  @ApiProperty({
    description: 'Full path string',
    example: 'Projects/Web Development',
  })
  fullPath: string;

  @ApiProperty({ description: 'Whether folder has children', example: true })
  hasChildren: boolean;
}

export class FolderWithScrapsDto extends FolderResponseDto {
  @ApiProperty({
    description: 'Scraps in the folder',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        scrapId: { type: 'number', example: 1 },
        title: { type: 'string', example: 'Article Title' },
        url: { type: 'string', example: 'https://example.com' },
        createdAt: { type: 'string', format: 'date-time' },
        isPinned: { type: 'boolean', example: false },
        sortOrder: { type: 'number', example: 0 },
      },
    },
  })
  scraps: {
    scrapId: number;
    title: string;
    url: string;
    createdAt: Date;
    isPinned: boolean;
    sortOrder: number;
  }[];

  @ApiProperty({ description: 'Number of scraps in folder', example: 5 })
  scrapCount: number;
}

export class FolderStatsDto {
  @ApiProperty({ description: 'Total number of folders', example: 10 })
  totalFolders: number;

  @ApiProperty({
    description: 'Total number of scraps across all folders',
    example: 50,
  })
  totalScraps: number;

  @ApiProperty({ description: 'Average scraps per folder', example: 5.0 })
  avgScrapsPerFolder: number;

  @ApiProperty({ description: 'Deepest folder level', example: 3 })
  deepestLevel: number;

  @ApiProperty({
    description: 'Most used folder',
    required: false,
  })
  mostUsedFolder: {
    folderId: number;
    name: string;
    scrapCount: number;
  } | null;

  @ApiProperty({
    description: 'Recently used folders',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        folderId: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Research' },
        lastUsed: { type: 'string', format: 'date-time' },
      },
    },
  })
  recentlyUsedFolders: {
    folderId: number;
    name: string;
    lastUsed: Date;
  }[];
}

// API Response wrapper DTOs
export class CreateFolderResponse {
  @ApiProperty({ description: 'Success status', example: true })
  success: boolean;

  @ApiProperty({ description: 'Created folder', type: FolderTreeNodeDto })
  data: FolderTreeNodeDto;

  @ApiProperty({
    description: 'Response message',
    example: 'Folder created successfully',
  })
  message: string;
}

export class FolderListResponse {
  @ApiProperty({ description: 'Success status', example: true })
  success: boolean;

  @ApiProperty({
    description: 'Folder list with pagination info',
  })
  data: {
    folders: FolderTreeNodeDto[];
    pagination?: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };

  @ApiProperty({
    description: 'Response message',
    example: 'Folders retrieved successfully',
  })
  message: string;
}

export class FolderStatsResponse {
  @ApiProperty({ description: 'Success status', example: true })
  success: boolean;

  @ApiProperty({ description: 'Folder statistics', type: FolderStatsDto })
  data: FolderStatsDto;

  @ApiProperty({
    description: 'Response message',
    example: 'Folder statistics retrieved successfully',
  })
  message: string;
}

export class UpdateFolderResponse {
  @ApiProperty({ description: 'Success status', example: true })
  success: boolean;

  @ApiProperty({ description: 'Updated folder', type: FolderTreeNodeDto })
  data: FolderTreeNodeDto;

  @ApiProperty({
    description: 'Response message',
    example: 'Folder updated successfully',
  })
  message: string;
}

export class MoveFolderResponse {
  @ApiProperty({ description: 'Success status', example: true })
  success: boolean;

  @ApiProperty({ description: 'Moved folder', type: FolderTreeNodeDto })
  data: FolderTreeNodeDto;

  @ApiProperty({
    description: 'Response message',
    example: 'Folder moved successfully',
  })
  message: string;
}

export class FolderWithScrapsResponse {
  @ApiProperty({ description: 'Success status', example: true })
  success: boolean;

  @ApiProperty({ description: 'Folder with scraps', type: FolderWithScrapsDto })
  data: FolderWithScrapsDto;

  @ApiProperty({
    description: 'Response message',
    example: 'Folder with scraps retrieved successfully',
  })
  message: string;
}
