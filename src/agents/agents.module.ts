import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileAnalysisAgentService } from './services/file-analysis-agent.service';
import { NewsletterAgentService } from './services/newsletter-agent.service';
import { VertexAiFactory } from '../ai-workflows/services/vertex-ai.factory';
import { ScrapCombinationService } from '../ai-workflows/services/scrap-combination.service';
import { NewsletterPromptTemplatesService } from '../ai-workflows/prompts/newsletter-prompt-templates.service';
import { NewsletterWorkflowLanggraphService } from '../ai-workflows/services/newsletter-workflow-langgraph.service';
import { ArticleRegeneratorService } from '../ai-workflows/services/article-regenerator.service';

@Module({
  imports: [ConfigModule],
  providers: [
    VertexAiFactory,
    ScrapCombinationService,
    NewsletterPromptTemplatesService,
    NewsletterWorkflowLanggraphService,
    ArticleRegeneratorService,
    FileAnalysisAgentService,
    NewsletterAgentService,
  ],
  exports: [
    VertexAiFactory, // Export for use in other modules
    FileAnalysisAgentService,
    NewsletterAgentService,
    NewsletterWorkflowLanggraphService, // Export the new LangGraph service
  ],
})
export class AgentsModule {}
