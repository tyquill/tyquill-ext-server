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

/**
 * 스크랩별 사용자 코멘트 인터페이스
 */
export interface ScrapComment {
    scrapId: number;
    userComment: string;
}

/**
 * AI 아티클 생성 요청 DTO
 */
export class GenerateArticleDto {
    @ApiProperty()
    @IsString()
    topic: string;

    @ApiProperty()
    @IsString()
    keyInsight: string;

    @ApiProperty()
    @IsArray()
    @IsNumber({}, { each: true })
    scrapIds: number[];

    @ApiProperty()
    @IsOptional()
    @IsArray()
    scrapComments?: ScrapComment[];

    @ApiProperty()
    @IsOptional()
    @IsString()
    generationParams?: string;
}
