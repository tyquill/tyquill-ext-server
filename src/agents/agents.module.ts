import { Module } from '@nestjs/common';
import { FileAnalysisAgentService } from './services/file-analysis-agent.service';
import { NewsletterAgentService } from './services/newsletter-agent.service';

@Module({
  providers: [FileAnalysisAgentService, NewsletterAgentService],
  exports: [FileAnalysisAgentService, NewsletterAgentService],
})
export class AgentsModule {}


