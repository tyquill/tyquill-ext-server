import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
  Version,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FolderService } from '../../folders/services/folder.service';
import {
  CreateFolderDto,
  UpdateFolderDto,
  MoveScrapsToFolderDto,
  RemoveScrapsFromFolderDto,
  FolderQueryDto,
} from '../../folders/types/folder.types';
import { CreateFolderDto as ApiCreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto as ApiUpdateFolderDto } from './dto/update-folder.dto';
import { MoveFolderDto } from './dto/move-folder.dto';
import { AddScrapToFolderDto } from './dto/add-scrap-to-folder.dto';
import { FolderQueryDto as ApiFolderQueryDto } from './dto/folder-query.dto';
import {
  CreateFolderResponse,
  FolderListResponse,
  FolderStatsResponse,
  FolderTreeNodeDto,
  FolderWithScrapsDto,
  FolderStatsDto,
} from './dto/folder-response.dto';
import { Folder } from '../../folders/entities/folder.entity';
import { IFolderTreeNode, IFolderWithScraps, IFolderStats } from '../../folders/types/folder.types';

@ApiTags('folders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('folders')
export class FoldersController {
  constructor(private readonly folderService: FolderService) {}

  private mapFolderToDto(folder: Folder): FolderTreeNodeDto {
    return {
      folderId: folder.folderId,
      name: folder.name,
      description: folder.description,
      color: folder.color,
      icon: folder.icon,
      sortOrder: folder.sortOrder,
      isDeleted: folder.isDeleted,
      isSystem: folder.isSystem,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
      deletedAt: folder.deletedAt,
      parentFolderId: folder.parentFolder?.folderId,
      userId: (folder.user as any)?.userId || folder.user,
      children: [],
      scrapCount: folder.scrapCount || 0,
      level: folder.level || 0,
      fullPath: folder.fullPath || folder.name,
      hasChildren: folder.hasChildren || false,
    };
  }

  /**
   * GET /api/v1/folders - Get user's folder tree
   */
  @Version('1')
  @Get()
  @ApiOperation({ summary: 'Get folder tree structure for the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Folder tree retrieved successfully',
    type: FolderListResponse,
  })
  @ApiQuery({ type: ApiFolderQueryDto, required: false })
  async getFolderTree(
    @Request() req: any,
    @Query() query: ApiFolderQueryDto,
  ): Promise<FolderListResponse> {
    try {
      const userId = parseInt(req.user.id);

      // Map API DTO to service DTO
      const serviceQuery: FolderQueryDto = {
        search: query.search,
        includeDeleted: query.includeDeleted,
        includeSystem: query.includeSystem,
        parentId: query.parentId,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        limit: query.limit,
        offset: query.offset,
      };

      const folders = await this.folderService.getFolderTree(userId, serviceQuery);

      return {
        success: true,
        data: {
          folders: folders as FolderTreeNodeDto[],
          pagination: query.limit ? {
            total: folders.length,
            limit: query.limit,
            offset: query.offset || 0,
            hasMore: false, // Would need total count from service
          } : undefined,
        },
        message: 'Folders retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve folders',
        error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/v1/folders - Create new folder
   */
  @Version('1')
  @Post()
  @ApiOperation({ summary: 'Create a new folder' })
  @ApiResponse({
    status: 201,
    description: 'Folder created successfully',
    type: CreateFolderResponse,
  })
  async createFolder(
    @Request() req: any,
    @Body() createFolderDto: ApiCreateFolderDto,
  ): Promise<CreateFolderResponse> {
    try {
      const userId = parseInt(req.user.id);

      // Map API DTO to service DTO
      const serviceDto: CreateFolderDto = {
        name: createFolderDto.name,
        description: createFolderDto.description,
        color: createFolderDto.color,
        icon: createFolderDto.icon,
        sortOrder: createFolderDto.sortOrder,
        parentFolderId: createFolderDto.parentFolderId,
      };

      const folder = await this.folderService.createFolder(userId, serviceDto);

      return {
        success: true,
        data: this.mapFolderToDto(folder),
        message: 'Folder created successfully',
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to create folder',
        error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * PATCH /api/v1/folders/:id - Update folder details
   */
  @Version('1')
  @Patch(':id')
  @ApiOperation({ summary: 'Update folder details' })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiResponse({
    status: 200,
    description: 'Folder updated successfully',
    type: FolderTreeNodeDto,
  })
  async updateFolder(
    @Request() req: any,
    @Param('id', ParseIntPipe) folderId: number,
    @Body() updateFolderDto: ApiUpdateFolderDto,
  ): Promise<{ success: boolean; data: FolderTreeNodeDto; message: string }> {
    try {
      const userId = parseInt(req.user.id);

      // Map API DTO to service DTO
      const serviceDto: UpdateFolderDto = {
        name: updateFolderDto.name,
        description: updateFolderDto.description,
        color: updateFolderDto.color,
        icon: updateFolderDto.icon,
        sortOrder: updateFolderDto.sortOrder,
        parentFolderId: updateFolderDto.parentFolderId,
        isDeleted: updateFolderDto.isDeleted,
      };

      const folder = await this.folderService.updateFolder(userId, folderId, serviceDto);

      return {
        success: true,
        data: this.mapFolderToDto(folder),
        message: 'Folder updated successfully',
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to update folder',
        error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * DELETE /api/v1/folders/:id - Soft delete folder
   */
  @Version('1')
  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a folder' })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiResponse({
    status: 200,
    description: 'Folder deleted successfully',
  })
  async deleteFolder(
    @Request() req: any,
    @Param('id', ParseIntPipe) folderId: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const userId = parseInt(req.user.id);
      await this.folderService.deleteFolder(userId, folderId);

      return {
        success: true,
        message: 'Folder deleted successfully',
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to delete folder',
        error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/v1/folders/:id/move - Move folder to different parent
   */
  @Version('1')
  @Post(':id/move')
  @ApiOperation({ summary: 'Move folder to a different parent' })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiResponse({
    status: 200,
    description: 'Folder moved successfully',
    type: FolderTreeNodeDto,
  })
  async moveFolder(
    @Request() req: any,
    @Param('id', ParseIntPipe) folderId: number,
    @Body() moveFolderDto: MoveFolderDto,
  ): Promise<{ success: boolean; data: FolderTreeNodeDto; message: string }> {
    try {
      const userId = parseInt(req.user.id);

      const serviceDto: UpdateFolderDto = {
        parentFolderId: moveFolderDto.newParentId,
      };

      const folder = await this.folderService.updateFolder(userId, folderId, serviceDto);

      return {
        success: true,
        data: this.mapFolderToDto(folder),
        message: 'Folder moved successfully',
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to move folder',
        error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/v1/folders/:id/scraps - Add scraps to folder
   */
  @Version('1')
  @Post(':id/scraps')
  @ApiOperation({ summary: 'Add scraps to a folder' })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiResponse({
    status: 200,
    description: 'Scraps added to folder successfully',
  })
  async addScrapsToFolder(
    @Request() req: any,
    @Param('id', ParseIntPipe) folderId: number,
    @Body() addScrapDto: AddScrapToFolderDto,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const userId = parseInt(req.user.id);

      const serviceDto: MoveScrapsToFolderDto = {
        scrapIds: addScrapDto.scrapIds,
        folderId: folderId,
        notes: addScrapDto.notes,
        isPinned: addScrapDto.isPinned,
        sortOrder: addScrapDto.sortOrder,
      };

      await this.folderService.moveScrapsToFolder(userId, serviceDto);

      return {
        success: true,
        message: 'Scraps added to folder successfully',
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to add scraps to folder',
        error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * DELETE /api/v1/folders/:id/scraps/:scrapId - Remove scrap from folder
   */
  @Version('1')
  @Delete(':id/scraps/:scrapId')
  @ApiOperation({ summary: 'Remove a scrap from a folder' })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiParam({ name: 'scrapId', description: 'Scrap ID' })
  @ApiResponse({
    status: 200,
    description: 'Scrap removed from folder successfully',
  })
  async removeScrapFromFolder(
    @Request() req: any,
    @Param('id', ParseIntPipe) folderId: number,
    @Param('scrapId', ParseIntPipe) scrapId: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const userId = parseInt(req.user.id);

      const serviceDto: RemoveScrapsFromFolderDto = {
        scrapIds: [scrapId],
        folderId: folderId,
      };

      await this.folderService.removeScrapsFromFolder(userId, serviceDto);

      return {
        success: true,
        message: 'Scrap removed from folder successfully',
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to remove scrap from folder',
        error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/v1/folders/:id/scraps - Get scraps in folder
   */
  @Version('1')
  @Get(':id/scraps')
  @ApiOperation({ summary: 'Get all scraps in a folder' })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiResponse({
    status: 200,
    description: 'Folder with scraps retrieved successfully',
    type: FolderWithScrapsDto,
  })
  async getFolderWithScraps(
    @Request() req: any,
    @Param('id', ParseIntPipe) folderId: number,
  ): Promise<{ success: boolean; data: FolderWithScrapsDto; message: string }> {
    try {
      const userId = parseInt(req.user.id);
      const folderWithScraps = await this.folderService.getFolderWithScraps(userId, folderId);

      return {
        success: true,
        data: folderWithScraps as FolderWithScrapsDto,
        message: 'Folder with scraps retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve folder with scraps',
        error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/v1/folders/stats - Get folder statistics
   */
  @Version('1')
  @Get('stats')
  @ApiOperation({ summary: 'Get folder usage statistics for the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Folder statistics retrieved successfully',
    type: FolderStatsResponse,
  })
  async getFolderStats(
    @Request() req: any,
  ): Promise<FolderStatsResponse> {
    try {
      const userId = parseInt(req.user.id);
      const stats = await this.folderService.getFolderStats(userId);

      return {
        success: true,
        data: stats as FolderStatsDto,
        message: 'Folder statistics retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve folder statistics',
        error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/v1/folders/:id/restore - Restore a deleted folder
   */
  @Version('1')
  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted folder' })
  @ApiParam({ name: 'id', description: 'Folder ID' })
  @ApiResponse({
    status: 200,
    description: 'Folder restored successfully',
  })
  async restoreFolder(
    @Request() req: any,
    @Param('id', ParseIntPipe) folderId: number,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const userId = parseInt(req.user.id);
      await this.folderService.restoreFolder(userId, folderId);

      return {
        success: true,
        message: 'Folder restored successfully',
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to restore folder',
        error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}