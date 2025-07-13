import { Module } from '@nestjs/common';
import { ScrapCombinationService } from './scrap-combination.service';
import { NewsletterWorkflowService } from './newsletter-workflow.service';
import { NewsletterToolsService } from './newsletter-tools.service';
import { NewsletterPromptTemplatesService } from './newsletter-prompt-templates.service';
import { NewsletterAgentService } from './newsletter-agent.service';
import { NewsletterQualityService } from './newsletter-quality.service';

@Module({
  providers: [
    ScrapCombinationService, 
    NewsletterWorkflowService,
    NewsletterToolsService,
    NewsletterPromptTemplatesService,
    NewsletterAgentService,
    NewsletterQualityService,
  ],
  exports: [
    ScrapCombinationService, 
    NewsletterWorkflowService,
    NewsletterToolsService,
    NewsletterPromptTemplatesService,
    NewsletterAgentService,
    NewsletterQualityService,
  ],
})
export class AgentModule {} 