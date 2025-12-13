import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NewsletterAgentService } from './services/newsletter-agent.service';
import { VertexAiFactory } from '../ai-workflows/services/vertex-ai.factory';
import { ScrapCombinationService } from '../ai-workflows/services/scrap-combination.service';
import { NewsletterPromptTemplatesService } from '../ai-workflows/prompts/newsletter-prompt-templates.service';
import { NewsletterWorkflowLanggraphService } from '../ai-workflows/services/newsletter-workflow-langgraph.service';
import { ArticleRegeneratorService } from '../ai-workflows/services/article-regenerator.service';
import { LangfuseService } from '../ai-workflows/services/langfuse.service';

@Module({
  imports: [ConfigModule],
  providers: [
    LangfuseService,
    VertexAiFactory,
    ScrapCombinationService,
    NewsletterPromptTemplatesService,
    NewsletterWorkflowLanggraphService,
    ArticleRegeneratorService,
    NewsletterAgentService,
  ],
  exports: [
    LangfuseService, // Export for use in other modules
    VertexAiFactory, // Export for use in other modules
    NewsletterAgentService,
    NewsletterWorkflowLanggraphService, // Export the new LangGraph service
  ],
})
export class AgentsModule {}
