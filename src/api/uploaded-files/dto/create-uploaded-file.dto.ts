import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateUploadedFileDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;
}
