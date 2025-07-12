import { IsString, IsArray, IsNumber, IsOptional } from 'class-validator';

export class CreateArticleDto {
    generationParams: string;
    topic: string;
    keyInsights: string;
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
    @IsString()
    topic: string;

    @IsString()
    keyInsight: string;

    @IsArray()
    @IsNumber({}, { each: true })
    scrapIds: number[];

    @IsOptional()
    @IsArray()
    scrapComments?: ScrapComment[];

    @IsOptional()
    @IsString()
    generationParams?: string;
}
