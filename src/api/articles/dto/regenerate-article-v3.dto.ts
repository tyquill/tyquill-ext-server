import {
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WritingStyleIdentifierLike } from '../../../writing-styles/utils/writing-style-identifier.util';

export class UploadWithUsagePromptDto {
  @ApiPropertyOptional({
    description: 'Upload ID to include (Scrap UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsString()
  uploadedFileId: string;

  @ApiPropertyOptional({
    description: 'Usage instructions for this upload',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  usagePrompt?: string;
}

export class RegenerateArticleV3Dto {
  @ApiPropertyOptional({
    description: 'Article topic. If not provided, keeps existing value',
    example: 'The Future of AI in Content Marketing',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  topic?: string;

  @ApiPropertyOptional({
    description: 'Key insight or angle. If not provided, keeps existing value',
    example: 'AI tools reduce content creation time by 80%',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  keyInsight?: string;

  @ApiPropertyOptional({
    description:
      'Array of scrap IDs to add to the article. These scraps will be added to existing scraps (UUIDs)',
    example: ['550e8400-e29b-41d4-a716-446655440000', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  addedScrapIds?: string[];

  @ApiPropertyOptional({
    description:
      'Array of scrap IDs to remove from the article. These scraps will be removed from existing scraps (UUIDs)',
    example: ['550e8400-e29b-41d4-a716-446655440000', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  removedScrapIds?: string[];

  @ApiPropertyOptional({
    description:
      'Writing style ID (UUID or legacy integer). Pass null to remove, omit to keep existing, or provide ID to change',
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  @IsOptional()
  writingStyleId?: WritingStyleIdentifierLike | null;

  @ApiPropertyOptional({
    description:
      'JSON string of generation parameters. If not provided, keeps existing value',
    example: '{"tone": "professional", "length": "medium"}',
  })
  @IsOptional()
  @IsString()
  generationParams?: string;

  @ApiPropertyOptional({
    description: 'List of uploaded files with usage prompts',
    type: [UploadWithUsagePromptDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UploadWithUsagePromptDto)
  uploadWithUsagePrompt?: UploadWithUsagePromptDto[];
}
