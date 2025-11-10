import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsNumber, IsOptional } from 'class-validator';

export class CreateArticleDto {
  @ApiProperty()
  @IsString()
  topic: string;

  @ApiProperty()
  @IsString()
  keyInsights: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  generationParams?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({
    description: 'Scrap IDs (UUIDs or legacy integers)',
    example: [
      '550e8400-e29b-41d4-a716-446655440000',
      '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  scrapIds: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  folderId?: string | null;
}
