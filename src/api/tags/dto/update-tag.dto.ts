import { PartialType } from '@nestjs/mapped-types';
import { CreateTagDto } from './create-tag.dto';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTagDto extends PartialType(CreateTagDto) {
  @ApiProperty()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
