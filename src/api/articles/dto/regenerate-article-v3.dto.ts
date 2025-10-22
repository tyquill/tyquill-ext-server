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

export class UploadWithUsagePromptDto {
  @ApiPropertyOptional({ description: 'Upload ID to include' })
  @IsNumber()
  uploadedFileId: number;

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
      'Array of scrap IDs to add to the article. These scraps will be added to existing scraps',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  addedScrapIds?: number[];

  @ApiPropertyOptional({
    description:
      'Array of scrap IDs to remove from the article. These scraps will be removed from existing scraps',
    example: [4, 5],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  removedScrapIds?: number[];

  @ApiPropertyOptional({
    description:
      'Writing style ID. Pass null to remove, omit to keep existing, or provide ID to change',
    example: 123,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  writingStyleId?: number | null;

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
