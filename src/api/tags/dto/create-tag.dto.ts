import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsNumber, IsOptional } from 'class-validator';

export class CreateTagDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  scrapId?: number;
}
