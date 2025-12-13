import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Langfuse CallbackHandler를 제공하는 서비스
 * CJS 환경(NestJS)에서 ESM 모듈을 사용하기 위해 dynamic import 사용
 */
@Injectable()
export class LangfuseService implements OnModuleInit {
  private readonly logger = new Logger(LangfuseService.name);
  private CallbackHandlerClass: any;
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    try {
      // Dynamic import로 ESM 모듈 로드
      const { CallbackHandler } = await import('@langfuse/langchain');
      this.CallbackHandlerClass = CallbackHandler;
      this.isInitialized = true;
      this.logger.log('✅ Langfuse CallbackHandler initialized successfully');
    } catch (error) {
      this.logger.error(
        '❌ Failed to initialize Langfuse CallbackHandler:',
        error,
      );
      this.logger.warn(
        'LangChain calls will not be traced by Langfuse. Check your @langfuse/langchain installation.',
      );
    }
  }

  /**
   * 새로운 CallbackHandler 인스턴스 생성
   * LangChain 체인에 전달하여 트레이싱 활성화
   *
   * @param options - CallbackHandler 옵션 (sessionId, userId, metadata 등)
   * @returns CallbackHandler 인스턴스 또는 null
   */
  createHandler(options?: {
    sessionId?: string;
    userId?: string;
    metadata?: Record<string, any>;
    tags?: string[];
  }): any {
    if (!this.isInitialized || !this.CallbackHandlerClass) {
      this.logger.warn(
        'Langfuse CallbackHandler not initialized. Returning null.',
      );
      return null;
    }

    try {
      const publicKey = this.configService.get<string>('LANGFUSE_PUBLIC_KEY');
      const secretKey = this.configService.get<string>('LANGFUSE_SECRET_KEY');
      const baseUrl =
        this.configService.get<string>('LANGFUSE_BASE_URL') ||
        'https://cloud.langfuse.com';

      if (!publicKey || !secretKey) {
        this.logger.warn(
          'Langfuse credentials not found in environment variables. Returning null.',
        );
        return null;
      }

      return new this.CallbackHandlerClass({
        publicKey,
        secretKey,
        baseUrl,
        ...options,
      });
    } catch (error) {
      this.logger.error('Failed to create Langfuse CallbackHandler:', error);
      return null;
    }
  }

  /**
   * CallbackHandler가 초기화되었는지 확인
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}
