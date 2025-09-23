import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsHexColor,
  Length,
  Min,
  Max,
  IsArray,
  ValidateNested,
  IsInt,
  IsPositive
} from 'class-validator';

// Base folder interface
export interface IFolder {
  folderId: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder: number;
  isDeleted: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  parentFolderId?: number;
  userId: number;
}

// Folder tree structure for API responses
export interface IFolderTreeNode extends IFolder {
  children: IFolderTreeNode[];
  scrapCount: number;
  level: number;
  fullPath: string;
  hasChildren: boolean;
}

// Folder with scraps included
export interface IFolderWithScraps extends IFolder {
  scraps: {
    scrapId: number;
    title: string;
    url: string;
    createdAt: Date;
    isPinned: boolean;
    sortOrder: number;
  }[];
  scrapCount: number;
}

// Create folder DTO
export class CreateFolderDto {
  @IsString()
  @Length(1, 255)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  icon?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999999)
  sortOrder?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  parentFolderId?: number;
}

// Update folder DTO
export class UpdateFolderDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  icon?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999999)
  sortOrder?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  parentFolderId?: number;

  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;
}

// Move scraps to folder DTO
export class MoveScrapsToFolderDto {
  @IsArray()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  scrapIds: number[];

  @IsInt()
  @IsPositive()
  folderId: number;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

// Remove scraps from folder DTO
export class RemoveScrapsFromFolderDto {
  @IsArray()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  scrapIds: number[];

  @IsInt()
  @IsPositive()
  folderId: number;
}

// Bulk folder operations DTO
export class BulkFolderOperationDto {
  @IsArray()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  folderIds: number[];

  @IsString()
  operation: 'delete' | 'restore' | 'move';

  @IsOptional()
  @IsInt()
  @IsPositive()
  targetParentId?: number;
}

// Folder search/filter options
export class FolderQueryDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;

  @IsOptional()
  @IsBoolean()
  includeDeleted?: boolean;

  @IsOptional()
  @IsBoolean()
  includeSystem?: boolean;

  @IsOptional()
  @IsInt()
  @IsPositive()
  parentId?: number;

  @IsOptional()
  @IsString()
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'sortOrder';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

// Folder statistics
export interface IFolderStats {
  totalFolders: number;
  totalScraps: number;
  avgScrapsPerFolder: number;
  deepestLevel: number;
  mostUsedFolder: {
    folderId: number;
    name: string;
    scrapCount: number;
  } | null;
  recentlyUsedFolders: {
    folderId: number;
    name: string;
    lastUsed: Date;
  }[];
}

// Error types
export class FolderError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'FolderError';
  }
}

export class FolderNotFoundError extends FolderError {
  constructor(folderId: number) {
    super(`Folder with ID ${folderId} not found`, 'FOLDER_NOT_FOUND', 404);
  }
}

export class CircularReferenceError extends FolderError {
  constructor() {
    super(
      'Cannot move folder: would create circular reference',
      'CIRCULAR_REFERENCE',
      400
    );
  }
}

export class FolderNameConflictError extends FolderError {
  constructor(name: string) {
    super(
      `Folder with name "${name}" already exists in this location`,
      'NAME_CONFLICT',
      409
    );
  }
}

// Response types
export interface CreateFolderResponse {
  success: boolean;
  data: IFolderTreeNode;
  message: string;
}

export interface FolderListResponse {
  success: boolean;
  data: {
    folders: IFolderTreeNode[];
    pagination?: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
  message: string;
}

export interface FolderStatsResponse {
  success: boolean;
  data: IFolderStats;
  message: string;
}