import { PartialType } from '@nestjs/mapped-types';
import { CreateScrapDto } from './create-scrap.dto';
import { IsOptional, IsString, MaxLength, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateScrapDto extends PartialType(CreateScrapDto) {
  @ApiProperty()
  @IsOptional()
  @IsUrl()
  @MaxLength(2000)
  url?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  title?: string;



  @ApiProperty()
  @IsOptional()
  @IsString()
  htmlContent?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  userComment?: string;
}
