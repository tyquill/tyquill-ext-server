import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Version,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ContentService } from '../../content/content.service';
import { UnifiedContentQueryDto } from './dto/unified-content-query.dto';
import { UnifiedContentResponseDto } from './dto/unified-content-response.dto';

@ApiTags('content')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  /**
   * GET /api/v1/content/unified - Get unified content (scraps and articles)
   *
   * This endpoint provides a unified view of both scraps and articles with:
   * - Pagination support
   * - Flexible filtering (by folder, type, tags)
   * - Search across titles and content
   * - Sorting by multiple fields
   *
   * Query Parameters:
   * - folderId: Filter by folder (null for root items, omit for all)
   * - type: Filter by content type (scrap, article, or all)
   * - scrapType: Sub-filter for scraps (webclip or upload)
   * - page: Page number (default: 1)
   * - limit: Items per page (default: 20, max: 100)
   * - sortBy: Field to sort by (createdAt, updatedAt, title)
   * - sortOrder: Sort direction (ASC or DESC)
   * - search: Search in title and content
   * - tags: Filter by tag names (OR logic)
   *
   * Example Usage:
   * - Get all content: GET /api/v1/content/unified
   * - Get only scraps: GET /api/v1/content/unified?type=scrap
   * - Get folder contents: GET /api/v1/content/unified?folderId=abc-123
   * - Search content: GET /api/v1/content/unified?search=typescript
   * - Filter by tags: GET /api/v1/content/unified?tags=javascript&tags=tutorial
   */
  @Version('1')
  @Get('unified')
  @ApiOperation({
    summary: 'Get unified content (scraps and articles)',
    description:
      'Retrieve a paginated list of scraps and/or articles with flexible filtering, search, and sorting options',
  })
  @ApiResponse({
    status: 200,
    description: 'Unified content retrieved successfully',
    type: UnifiedContentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid query parameters',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing JWT token',
  })
  async getUnifiedContent(
    @Query() query: UnifiedContentQueryDto,
    @Request() req: any,
  ): Promise<UnifiedContentResponseDto> {
    try {
      const userId = req.user.id;

      return await this.contentService.getUnifiedContent(userId, query);
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      // Log the error for debugging
      console.error('Error fetching unified content:', error);

      throw new HttpException(
        error.message || 'Failed to fetch unified content',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
