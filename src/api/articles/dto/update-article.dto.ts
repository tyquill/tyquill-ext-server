import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateArticleDto } from './create-article.dto';

export class UpdateArticleDto extends PartialType(CreateArticleDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contentFormat?: 'markdown' | 'tiptap-json';
}
