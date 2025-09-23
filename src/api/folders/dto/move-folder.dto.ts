import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsInt,
  IsPositive
} from 'class-validator';

export class MoveFolderDto {
  @ApiProperty({
    description: 'New parent folder ID (null or omit to move to root)',
    required: false,
    example: 3
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  newParentId?: number;
}