import { Module } from '@nestjs/common';
import { ScrapCombinationService } from './scrap-combination.service';
import { NewsletterWorkflowService } from './newsletter-workflow.service';
import { NewsletterPromptTemplatesService } from './newsletter-prompt-templates.service';

@Module({
  providers: [
    ScrapCombinationService, 
    NewsletterWorkflowService,
    NewsletterPromptTemplatesService,
  ],
  exports: [
    ScrapCombinationService, 
    NewsletterWorkflowService,
    NewsletterPromptTemplatesService,
  ],
})
export class AgentModule {} 