import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUploadedFileDto {
  @ApiProperty({ description: 'The title of the uploaded file', maxLength: 255})
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title: string;

  @ApiProperty({ description: 'The description of the uploaded file'})
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;
}
