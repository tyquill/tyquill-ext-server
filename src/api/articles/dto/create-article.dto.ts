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

    @ApiProperty()
    @IsNumber()
    userId: number;

    @ApiProperty()
    @IsArray()
    @IsNumber({}, { each: true })
    scrapIds: number[];
}