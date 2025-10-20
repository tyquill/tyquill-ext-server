import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Version,
  Query,
  HttpException,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FoldersService } from '../../folders/folders.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { MoveFolderItemsDto } from './dto/move-folder-items.dto';
import {
  FolderResponseDto,
  FolderContentsDto,
} from './dto/folder-response.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('folders')
@UseGuards(JwtAuthGuard)
@Controller('folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  /**
   * POST /api/v1/folders - Create a new folder
   */
  @Version('1')
  @Post()
  @ApiOperation({ summary: 'Create a new folder' })
  @ApiResponse({
    status: 201,
    description: 'Folder created successfully',
    type: FolderResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Parent folder not found' })
  async create(
    @Body() createFolderDto: CreateFolderDto,
    @Request() req: any,
  ): Promise<FolderResponseDto> {
    try {
      const userId = parseInt(req.user.id);
      return await this.foldersService.create(userId, createFolderDto);
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /api/v1/folders - Get all folders for current user
   * Query params:
   * - parentId: Filter by parent folder (null for root folders)
   */
  @Version('1')
  @Get()
  @ApiOperation({ summary: 'Get all folders for current user' })
  @ApiResponse({
    status: 200,
    description: 'Folders retrieved successfully',
    type: [FolderResponseDto],
  })
  async findAll(
    @Request() req: any,
    @Query('parentId') parentId?: string,
  ): Promise<FolderResponseDto[]> {
    try {
      const userId = parseInt(req.user.id);

      // Convert 'null' string to actual null for root folders
      const parentFolderId = parentId === 'null' ? null : parentId || undefined;

      return await this.foldersService.findAll(userId, parentFolderId);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * GET /api/v1/folders/:id - Get a specific folder by ID
   */
  @Version('1')
  @Get(':id')
  @ApiOperation({ summary: 'Get a specific folder by ID' })
  @ApiResponse({
    status: 200,
    description: 'Folder retrieved successfully',
    type: FolderResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  async findOne(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<FolderResponseDto> {
    try {
      const userId = parseInt(req.user.id);
      return await this.foldersService.findOne(id, userId);
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * PATCH /api/v1/folders/:id - Update a folder
   */
  @Version('1')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a folder' })
  @ApiResponse({
    status: 200,
    description: 'Folder updated successfully',
    type: FolderResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  async update(
    @Param('id') id: string,
    @Body() updateFolderDto: UpdateFolderDto,
    @Request() req: any,
  ): Promise<FolderResponseDto> {
    try {
      const userId = parseInt(req.user.id);
      return await this.foldersService.update(id, userId, updateFolderDto);
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * DELETE /api/v1/folders/:id - Soft delete a folder
   */
  @Version('1')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a folder (soft delete)' })
  @ApiResponse({
    status: 200,
    description: 'Folder deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete folder with children',
  })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  async remove(@Param('id') id: string, @Request() req: any) {
    try {
      const userId = parseInt(req.user.id);
      await this.foldersService.remove(id, userId);
      return { message: 'Folder deleted successfully' };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * POST /api/v1/folders/:id/items - Move scraps/articles to a folder
   * POST /api/v1/folders/items (with targetFolderId: null) - Remove items from folder
   */
  @Version('1')
  @Post(':id/items')
  @ApiOperation({ summary: 'Move scraps/articles to a folder' })
  @ApiResponse({
    status: 200,
    description: 'Items moved successfully',
  })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  async moveItems(
    @Param('id') id: string,
    @Body() moveFolderItemsDto: MoveFolderItemsDto,
    @Request() req: any,
  ) {
    try {
      const userId = parseInt(req.user.id);

      // Use targetFolderId from DTO if provided, otherwise use URL param
      const targetFolderId =
        moveFolderItemsDto.targetFolderId !== undefined
          ? moveFolderItemsDto.targetFolderId
          : id;

      const result = await this.foldersService.moveItemsToFolder(
        targetFolderId,
        userId,
        moveFolderItemsDto.scrapIds,
        moveFolderItemsDto.articleIds,
      );

      return {
        message: 'Items moved successfully',
        ...result,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /api/v1/folders/:id/contents - Get folder contents (scraps, articles, child folders)
   */
  @Version('1')
  @Get(':id/contents')
  @ApiOperation({ summary: 'Get folder contents' })
  @ApiResponse({
    status: 200,
    description: 'Folder contents retrieved successfully',
    type: FolderContentsDto,
  })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  async getFolderContents(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<FolderContentsDto> {
    try {
      const userId = parseInt(req.user.id);
      return await this.foldersService.getFolderContents(id, userId);
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
