import { PartialType } from '@nestjs/mapped-types';
import { CreateTagDto } from './create-tag.dto';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTagDto extends PartialType(CreateTagDto) {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
