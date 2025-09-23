import { ApiProperty } from '@nestjs/swagger';

export class ScrapResponseDto {
  @ApiProperty({ description: 'Scrap ID', example: 1 })
  scrapId: number;

  @ApiProperty({ description: 'URL of the scraped content', example: 'https://example.com/article' })
  url: string;

  @ApiProperty({ description: 'Title of the scraped content', example: 'How to Build Better APIs' })
  title: string;

  @ApiProperty({
    description: 'Full content of the scrap',
    example: 'This is the complete content of the scraped article...'
  })
  content: string;

  @ApiProperty({
    description: 'HTML content of the scrap',
    example: '<p>This is the HTML content...</p>'
  })
  htmlContent: string;

  @ApiProperty({
    description: 'Scrap description or summary',
    required: false,
    example: 'A comprehensive guide on API development'
  })
  description?: string;

  @ApiProperty({
    description: 'User comment on the scrap',
    required: false,
    example: 'This article has great insights on REST API design'
  })
  userComment?: string;

  @ApiProperty({
    description: 'File name for uploaded files',
    required: false,
    example: 'document.pdf'
  })
  fileName?: string;

  @ApiProperty({
    description: 'File path for uploaded files',
    required: false,
    example: '/uploads/files/document.pdf'
  })
  filePath?: string;

  @ApiProperty({
    description: 'MIME type for uploaded files',
    required: false,
    example: 'application/pdf'
  })
  mimeType?: string;

  @ApiProperty({
    description: 'File size in bytes',
    required: false,
    example: 1024000
  })
  fileSize?: number;

  @ApiProperty({
    description: 'AI-generated content analysis',
    required: false,
    example: 'This document discusses API authentication methods...'
  })
  aiContent?: string;

  @ApiProperty({ description: 'Whether the scrap is deleted', example: false })
  isDeleted: boolean;

  @ApiProperty({ description: 'Creation date', example: '2023-01-01T00:00:00Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date', example: '2023-01-01T00:00:00Z' })
  updatedAt: Date;

  @ApiProperty({
    description: 'Associated article ID',
    required: false,
    example: 1
  })
  articleId?: number;

  @ApiProperty({
    description: 'Tags associated with the scrap',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        tagId: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Technology' },
      }
    },
    example: [
      { tagId: 1, name: 'Technology' },
      { tagId: 2, name: 'API' }
    ]
  })
  tags?: {
    tagId: number;
    name: string;
  }[];

  @ApiProperty({
    description: 'Folders containing this scrap',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        folderId: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Research' },
      }
    },
    example: [
      { folderId: 1, name: 'Research' }
    ]
  })
  folders?: {
    folderId: number;
    name: string;
  }[];
}

export class ScrapSummaryDto {
  @ApiProperty({ description: 'Scrap ID', example: 1 })
  scrapId: number;

  @ApiProperty({ description: 'URL of the scraped content', example: 'https://example.com/article' })
  url: string;

  @ApiProperty({ description: 'Title of the scraped content', example: 'How to Build Better APIs' })
  title: string;

  @ApiProperty({
    description: 'Truncated content preview (max 100 characters)',
    example: 'This is the preview of the content that has been truncated for list views...'
  })
  contentPreview: string;

  @ApiProperty({
    description: 'Scrap description or summary',
    required: false,
    example: 'A comprehensive guide on API development'
  })
  description?: string;

  @ApiProperty({
    description: 'User comment on the scrap',
    required: false,
    example: 'This article has great insights on REST API design'
  })
  userComment?: string;

  @ApiProperty({
    description: 'File name for uploaded files',
    required: false,
    example: 'document.pdf'
  })
  fileName?: string;

  @ApiProperty({
    description: 'MIME type for uploaded files',
    required: false,
    example: 'application/pdf'
  })
  mimeType?: string;

  @ApiProperty({ description: 'Whether the scrap is deleted', example: false })
  isDeleted: boolean;

  @ApiProperty({ description: 'Creation date', example: '2023-01-01T00:00:00Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date', example: '2023-01-01T00:00:00Z' })
  updatedAt: Date;

  @ApiProperty({
    description: 'Associated article ID',
    required: false,
    example: 1
  })
  articleId?: number;

  @ApiProperty({
    description: 'Tags associated with the scrap',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        tagId: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Technology' },
      }
    },
    example: [
      { tagId: 1, name: 'Technology' }
    ]
  })
  tags?: {
    tagId: number;
    name: string;
  }[];

  @ApiProperty({
    description: 'Folders containing this scrap',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        folderId: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Research' },
      }
    },
    example: [
      { folderId: 1, name: 'Research' }
    ]
  })
  folders?: {
    folderId: number;
    name: string;
  }[];
}

export class ScrapListResponse {
  @ApiProperty({ description: 'Success status', example: true })
  success: boolean;

  @ApiProperty({
    description: 'List of scraps with pagination',
    type: 'object',
    properties: {
      scraps: {
        type: 'array',
        items: { $ref: '#/components/schemas/ScrapSummaryDto' }
      },
      total: { type: 'number', example: 50 },
      page: { type: 'number', example: 1 },
      limit: { type: 'number', example: 20 }
    }
  })
  data: {
    scraps: ScrapSummaryDto[];
    total?: number;
    page?: number;
    limit?: number;
  };

  @ApiProperty({ description: 'Response message', example: 'Scraps retrieved successfully' })
  message: string;
}

export class ScrapDetailResponse {
  @ApiProperty({ description: 'Success status', example: true })
  success: boolean;

  @ApiProperty({ description: 'Detailed scrap information', type: ScrapResponseDto })
  data: ScrapResponseDto;

  @ApiProperty({ description: 'Response message', example: 'Scrap retrieved successfully' })
  message: string;
}