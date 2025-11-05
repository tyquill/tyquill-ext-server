import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * API Key 인증 Guard
 *
 * X-API-Key 헤더를 검증하여 Slack Bot API에 대한 접근을 제어합니다.
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyAuthGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    const validApiKey = this.configService.get<string>('SLACK_BOT_API_KEY');

    if (!validApiKey) {
      this.logger.error('SLACK_BOT_API_KEY is not configured');
      throw new UnauthorizedException('API Key authentication is not configured');
    }

    if (!apiKey) {
      this.logger.warn('Missing X-API-Key header', {
        ip: request.ip,
        path: request.path,
      });
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    if (apiKey !== validApiKey) {
      this.logger.warn('Invalid API Key', {
        ip: request.ip,
        path: request.path,
      });
      throw new UnauthorizedException('Invalid API Key');
    }

    this.logger.debug('API Key validated successfully', {
      path: request.path,
    });

    return true;
  }
}
