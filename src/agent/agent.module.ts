import { Module } from '@nestjs/common';
import { ScrapCombinationService } from './scrap-combination.service';
import { NewsletterWorkflowService } from './newsletter-workflow.service';
import { NewsletterToolsService } from './newsletter-tools.service';
import { NewsletterPromptTemplatesService } from './newsletter-prompt-templates.service';
import { NewsletterAgentService } from './newsletter-agent.service';
import { NewsletterQualityService } from './newsletter-quality.service';
import { ToolNodesService } from './node/tool-nodes.service';
import { AgentNodesService } from './node/agent-nodes.service';
import { QualityNodesService } from './node/quality-nodes.service';

@Module({
  providers: [
    ScrapCombinationService, 
    NewsletterWorkflowService,
    NewsletterToolsService,
    NewsletterPromptTemplatesService,
    NewsletterAgentService,
    NewsletterQualityService,
    // 새로운 노드 서비스들 추가
    ToolNodesService,
    AgentNodesService,
    QualityNodesService,
  ],
  exports: [
    ScrapCombinationService, 
    NewsletterWorkflowService,
    NewsletterToolsService,
    NewsletterPromptTemplatesService,
    NewsletterAgentService,
    NewsletterQualityService,
    // 새로운 노드 서비스들 export
    ToolNodesService,
    AgentNodesService,
    QualityNodesService,
  ],
})
export class AgentModule {} 