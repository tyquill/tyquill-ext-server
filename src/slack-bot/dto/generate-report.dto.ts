import {
  IsString,
  IsArray,
  IsNumber,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Slack 메시지 DTO
 */
export class SlackMessageDto {
  @ApiProperty({
    description: 'Slack 메시지 텍스트',
    example: '프로젝트 A 진행 상황 공유',
  })
  @IsString()
  text: string;

  @ApiProperty({
    description: 'Slack 타임스탬프',
    example: '1730426400.123456',
  })
  @IsString()
  timestamp: string;

  @ApiProperty({
    description: '채널 ID',
    example: 'C08N8PYJW73',
  })
  @IsString()
  channel: string;

  @ApiProperty({
    description: '채널 이름',
    example: 'general',
    required: false,
  })
  @IsOptional()
  @IsString()
  channelName?: string;
}

/**
 * 날짜 범위 DTO
 */
export class DateRangeDto {
  @ApiProperty({
    description: '시작 날짜',
    example: '11월 1일',
  })
  @IsString()
  from: string;

  @ApiProperty({
    description: '종료 날짜',
    example: '11월 5일',
  })
  @IsString()
  to: string;
}

/**
 * 보고서 생성 요청 DTO
 */
export class GenerateReportDto {
  @ApiProperty({
    description: '보고서 주제',
    example: '주간 업무 보고서 (11월 1일 ~ 11월 5일)',
  })
  @IsString()
  topic: string;

  @ApiProperty({
    description: '핵심 인사이트',
    example: '이번 주 주요 업무 성과와 진행 상황을 요약합니다.',
  })
  @IsString()
  keyInsight: string;

  @ApiProperty({
    description: 'Slack 메시지 목록',
    type: [SlackMessageDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlackMessageDto)
  messages: SlackMessageDto[];

  @ApiProperty({
    description: '날짜 범위',
    type: DateRangeDto,
  })
  @ValidateNested()
  @Type(() => DateRangeDto)
  dateRange: DateRangeDto;

  @ApiProperty({
    description: '메시지 개수',
    example: 15,
  })
  @IsNumber()
  messageCount: number;
}
