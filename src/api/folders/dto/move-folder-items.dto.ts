import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsUUID } from 'class-validator';

export class MoveFolderItemsDto {
  @ApiProperty({
    description: 'Array of scrap IDs to move to this folder',
    required: false,
    example: [1, 2, 3],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  scrapIds?: number[];

  @ApiProperty({
    description: 'Array of article IDs to move to this folder',
    required: false,
    example: [10, 20, 30],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  articleIds?: number[];

  @ApiProperty({
    description: 'Target folder UUID (null to remove from folder)',
    required: false,
    nullable: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  targetFolderId?: string | null;
}
