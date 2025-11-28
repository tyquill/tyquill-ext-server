import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Version,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { SlackBotService } from '../../slack-bot/slack-bot.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { ReportResponseDto } from './dto/report-response.dto';
import { ApiKeyAuthGuard } from '../../slack-bot/guards/api-key-auth.guard';

/**
 * Slack Bot API 컨트롤러
 *
 * Slack Bot 전용 API 엔드포인트를 제공합니다.
 * API Key 인증을 사용하여 간단하게 보고서를 생성할 수 있습니다.
 */
@ApiTags('Slack Bot')
@Controller('slack-bot')
@UseGuards(ApiKeyAuthGuard)
export class SlackBotController {
  private readonly logger = new Logger(SlackBotController.name);

  constructor(private readonly slackBotService: SlackBotService) {}

  /**
   * Slack 메시지로 주간 보고서 생성
   */
  @Version('1')
  @Post('generate-report')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Slack 메시지로 주간 보고서 생성',
    description:
      'Slack Bot 전용 API입니다. API Key 인증이 필요하며, Slack 메시지를 받아 AI 기반 주간 보고서를 생성합니다. 완성된 보고서를 즉시 반환합니다.',
  })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'Slack Bot API Key (SLACK_BOT_API_KEY 환경 변수)',
    required: true,
    schema: {
      type: 'string',
      example: 'tyquill-slack-bot-secret-key-2025',
    },
  })
  @ApiResponse({
    status: 200,
    description: '보고서 생성 완료',
    type: ReportResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or missing API Key',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Invalid API Key' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Report generation failed',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Failed to generate report' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async generateReport(
    @Body() dto: GenerateReportDto,
  ): Promise<ReportResponseDto> {
    this.logger.log('Received report generation request', {
      topic: dto.topic,
      messageCount: dto.messageCount,
      dateRange: dto.dateRange,
    });

    return await this.slackBotService.generateReport(dto);
  }

  /**
   * 보고서 조회 (공유 기능에서 사용)
   */
  @Version('1')
  @Get('reports/:articleId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '생성된 보고서 조회',
    description:
      'articleId로 이미 생성된 보고서를 조회합니다. Slack Bot의 공유 기능에서 사용됩니다.',
  })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'Slack Bot API Key',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: '보고서 조회 성공',
    type: ReportResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Report not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Report not found' },
      },
    },
  })
  async getReport(
    @Param('articleId') articleId: string,
  ): Promise<ReportResponseDto> {
    this.logger.log('Received report retrieval request', {
      articleId,
    });

    const report = await this.slackBotService.getReport(articleId);

    if (!report) {
      throw new NotFoundException(`Report not found: ${articleId}`);
    }

    return report;
  }

  /**
   * Slack Bot API 상태 확인
   */
  @Version('1')
  @Get('health')
  @ApiOperation({
    summary: 'Slack Bot API 상태 확인',
    description: 'API가 정상 작동하는지 확인합니다.',
  })
  @ApiResponse({
    status: 200,
    description: 'API is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2025-11-05T05:00:00.000Z' },
        service: { type: 'string', example: 'slack-bot-api' },
      },
    },
  })
  healthCheck() {
    this.logger.debug('Health check requested');
    return this.slackBotService.healthCheck();
  }
}
