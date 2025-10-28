import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileAnalysisAgentService } from './services/file-analysis-agent.service';
import { NewsletterAgentService } from './services/newsletter-agent.service';
import { VertexAiFactory } from '../ai-workflows/services/vertex-ai.factory';
import { ScrapCombinationService } from '../ai-workflows/services/scrap-combination.service';
import { NewsletterPromptTemplatesService } from '../ai-workflows/prompts/newsletter-prompt-templates.service';
import { NewsletterWorkflowService } from '../ai-workflows/services/newsletter-workflow.service';
import { NewsletterStreamingService } from '../ai-workflows/services/newsletter-streaming.service';
import { ArticleRegeneratorService } from '../ai-workflows/services/article-regenerator.service';

@Module({
  imports: [ConfigModule],
  providers: [
    VertexAiFactory,
    ScrapCombinationService,
    NewsletterPromptTemplatesService,
    NewsletterWorkflowService,
    NewsletterStreamingService,
    ArticleRegeneratorService,
    FileAnalysisAgentService,
    NewsletterAgentService,
  ],
  exports: [FileAnalysisAgentService, NewsletterAgentService],
})
export class AgentsModule {}
