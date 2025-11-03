import { Injectable, Logger } from '@nestjs/common';

import {
  NewsletterWorkflowInput,
  NewsletterWorkflowOutput,
  PageStructureAnalysis,
} from '../../ai-workflows/dto/newsletter.dto';
import { NewsletterWorkflowService } from '../../ai-workflows/services/newsletter-workflow.service';
import { NewsletterStreamingService } from '../../ai-workflows/services/newsletter-streaming.service';
import {
  RegenerateArticleInput,
  RegenerateArticleOutput,
} from '../../ai-workflows/dto/regenerate.dto';
import { ArticleRegeneratorService } from '../../ai-workflows/services/article-regenerator.service';
import { StreamEvent } from '../../ai-workflows/models/streaming';

@Injectable()
export class NewsletterAgentService {
  private readonly logger = new Logger(NewsletterAgentService.name);

  constructor(
    private readonly newsletterWorkflowService: NewsletterWorkflowService,
    private readonly newsletterStreamingService: NewsletterStreamingService,
    private readonly articleRegeneratorService: ArticleRegeneratorService,
  ) {}

  async generateNewsletter(
    input: NewsletterWorkflowInput,
  ): Promise<NewsletterWorkflowOutput> {
    this.logger.log('🚀 Generating newsletter via LangGraph workflow');
    this.logger.log(`📝 Topic: ${input.topic}`);
    this.logger.log(`💡 Key insight: ${input.keyInsight || 'None'}`);
    this.logger.log(
      `📊 Scraps count: ${input.scrapsWithComments?.length ?? 0}`,
    );
    this.logger.log(
      `📄 PDF files count: ${input.pdfUrlsWithPrompts?.length ?? 0}`,
    );

    const result =
      await this.newsletterWorkflowService.generateNewsletter(input);

    this.logger.log('🎉 Newsletter generation completed successfully');
    return result;
  }

  async analyzePageStructure(content: string): Promise<PageStructureAnalysis> {
    this.logger.log('🔍 Analyzing page structure locally');
    return this.newsletterWorkflowService.analyzePageStructure(content);
  }

  generateNewsletterStream(
    input: NewsletterWorkflowInput,
  ): AsyncGenerator<StreamEvent, void, unknown> {
    this.logger.log('🌊 Streaming newsletter generation via LangGraph workflow');
    return this.newsletterStreamingService.generateNewsletterStream(input);
  }

  async regenerateArticle(
    input: RegenerateArticleInput,
  ): Promise<RegenerateArticleOutput> {
    this.logger.log('🔄 Regenerating article locally');
    return this.articleRegeneratorService.regenerateArticle(input);
  }
}
