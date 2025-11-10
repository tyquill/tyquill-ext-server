import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsIn, IsNotEmpty } from 'class-validator';

export class UpdateUserLanguageDto {
  @ApiProperty({
    description: 'User language preference (ISO 639-1 code)',
    example: 'en',
    enum: ['en', 'ko', 'ja', 'zh'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['en', 'ko', 'ja', 'zh'], {
    message: 'Language must be one of: en, ko, ja, zh',
  })
  language: string;
}
