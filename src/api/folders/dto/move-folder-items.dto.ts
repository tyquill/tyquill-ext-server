import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

export class MoveFolderItemsDto {
  @ApiProperty({
    description: 'Array of scrap IDs to move to this folder (UUIDs or legacy integers)',
    required: false,
    example: [
      '550e8400-e29b-41d4-a716-446655440000',
      '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    ],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scrapIds?: string[];

  @ApiProperty({
    description: 'Array of article IDs to move to this folder (UUIDs or legacy integers)',
    required: false,
    example: [
      '550e8400-e29b-41d4-a716-446655440000',
      '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    ],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  articleIds?: string[];

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
