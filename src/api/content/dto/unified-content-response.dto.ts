import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TagDto {
  @ApiProperty({
    description: 'Tag ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  tagId: string;

  @ApiPropertyOptional({
    description: 'Legacy numeric tag ID (for backward compatibility)',
    example: 1,
  })
  legacyTagId?: number;

  @ApiProperty({ example: 'javascript' })
  name: string;
}

export class UnifiedContentItemDto {
  @ApiProperty({
    description: 'Unique identifier (scrapId or articleId as string)',
    example: '123',
  })
  id: string;

  @ApiProperty({
    description: 'Type of content',
    enum: ['scrap', 'article'],
    example: 'scrap',
  })
  type: 'scrap' | 'article';

  @ApiProperty({ example: 'Introduction to TypeScript' })
  title: string;

  @ApiProperty({
    description: 'Preview of content (first 200 characters)',
    example: 'TypeScript is a typed superset of JavaScript...',
  })
  contentPreview: string;

  @ApiProperty({ example: '2025-10-19T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-10-19T12:45:00.000Z' })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Folder ID if item is in a folder',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  folderId?: string;

  // Scrap-specific fields
  @ApiPropertyOptional({
    description: 'URL of the scraped content (scrap only)',
    example: 'https://example.com/article',
  })
  url?: string;

  @ApiPropertyOptional({
    description: 'Type of scrap (scrap only)',
    enum: ['webclip', 'pdf', 'image', 'video', 'audio', 'upload'],
    example: 'webclip',
  })
  scrapType?: 'webclip' | 'pdf' | 'image' | 'video' | 'audio' | 'upload';

  @ApiPropertyOptional({
    description: 'Hero image URL (scrap only)',
    example: 'https://example.com/hero.jpg',
  })
  heroImageUrl?: string;

  @ApiPropertyOptional({
    description: 'Favicon URL (scrap only)',
    example: 'https://example.com/favicon.ico',
  })
  faviconUrl?: string;

  @ApiPropertyOptional({
    description: 'Tags associated with the scrap (scrap only)',
    type: [TagDto],
  })
  tags?: TagDto[];

  // Article-specific fields
  @ApiPropertyOptional({
    description: 'Article topic (article only)',
    example: 'Web Development Best Practices',
  })
  topic?: string;

  @ApiPropertyOptional({
    description: 'Key insight of the article (article only)',
    example: 'TypeScript provides type safety for JavaScript projects',
  })
  keyInsight?: string;

  @ApiPropertyOptional({
    description: 'Generation status (article only)',
    enum: ['processing', 'completed', 'failed'],
    example: 'completed',
  })
  generationStatus?: string;
}

export class UnifiedContentResponseDto {
  @ApiProperty({
    description: 'Array of unified content items',
    type: [UnifiedContentItemDto],
  })
  items: UnifiedContentItemDto[];

  @ApiProperty({
    description: 'Total number of items matching the query',
    example: 150,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Whether there are more items to load',
    example: true,
  })
  hasMore: boolean;

  @ApiProperty({
    description: 'Total number of pages',
    example: 8,
  })
  totalPages: number;
}
