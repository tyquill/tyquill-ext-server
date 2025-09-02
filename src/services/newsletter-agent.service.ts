import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface NewsletterInput {
  readonly topic: string;
  readonly keyInsight?: string;
  readonly scrapsWithComments: Array<{
    scrap: {
      id: number;
      title: string;
      url: string;
      content: string;
      userComment?: string;
    };
    userComment?: string;
  }>;
  readonly generationParams?: string;
  readonly articleStructureTemplate?: any[];
  readonly writingStyleExampleContents?: string[];
}

interface NewsletterOutput {
  title: string;
  content: string;
  analysisReason?: string;
  warnings?: string[];
}

interface PageStructureSection {
  title: string;
  children?: PageStructureSection[];
}

interface PageStructureAnalysis {
  sections: PageStructureSection[];
}

@Injectable()
export class NewsletterAgentService {
  private readonly logger = new Logger(NewsletterAgentService.name);
  private readonly agentApiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.agentApiUrl = this.configService.get<string>('TYQUILL_AGENT_API_URL')!;
    this.logger.log(`🤖 NewsletterAgentService initialized with agent URL: ${this.agentApiUrl}`);
  }

  async generateNewsletter(input: NewsletterInput): Promise<NewsletterOutput> {
    try {
      this.logger.log('🚀 Calling newsletter generation API');
      this.logger.log(`📝 Topic: ${input.topic}`);
      this.logger.log(`💡 Key insight: ${input.keyInsight || 'None'}`);
      this.logger.log(`📊 Scraps count: ${input.scrapsWithComments?.length || 0}`);

      const response = await fetch(`${this.agentApiUrl}/api/v1/newsletter/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      this.logger.log('🎉 Newsletter generation completed successfully');
      return result;
    } catch (error) {
      this.logger.error('🚨 Newsletter generation failed:', error);
      throw error;
    }
  }

  async analyzePageStructure(content: string): Promise<PageStructureAnalysis> {
    try {
      this.logger.log('🔍 Analyzing page structure');

      const response = await fetch(`${this.agentApiUrl}/api/v1/newsletter/analyze-structure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json() as PageStructureAnalysis;
      
      this.logger.log('✅ Page structure analysis completed');
      return result;
    } catch (error) {
      this.logger.error('❌ Page structure analysis failed:', error);
      throw error;
    }
  }
}