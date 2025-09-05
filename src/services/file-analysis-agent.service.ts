import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';


@Injectable()
export class FileAnalysisAgentService {
  private readonly logger = new Logger(FileAnalysisAgentService.name);
  private readonly agentApiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.agentApiUrl = this.configService.get<string>('TYQUILL_AGENT_API_URL')!;
    this.logger.log(`🤖 FileAnalysisAgentService initialized with agent URL: ${this.agentApiUrl}`);
  }

  async analyzeFile(fileUrl: string): Promise<string> {
    try {
      this.logger.log('📄 Calling file analysis API');

      const response = await fetch(`${this.agentApiUrl}/api/v1/pdf/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileUrl }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      this.logger.log('✅ File analysis completed successfully');
      return result;
    } catch (error) {
      this.logger.error('❌ File analysis failed:', error);
      throw error;
    }
  }
}