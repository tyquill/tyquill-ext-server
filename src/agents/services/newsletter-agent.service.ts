import { Injectable, Logger } from '@nestjs/common';

import {
  NewsletterWorkflowInput,
  NewsletterWorkflowOutput,
  PageStructureAnalysis,
} from '../../ai-workflows/dto/newsletter.dto';
import { NewsletterWorkflowLanggraphService } from '../../ai-workflows/services/newsletter-workflow-langgraph.service';
import {
  RegenerateArticleInput,
  RegenerateArticleOutput,
} from '../../ai-workflows/dto/regenerate.dto';
import { ArticleRegeneratorService } from '../../ai-workflows/services/article-regenerator.service';
import { StreamEvent, NodeName, NODE_MESSAGES, EventType } from '../../ai-workflows/models/streaming';

@Injectable()
export class NewsletterAgentService {
  private readonly logger = new Logger(NewsletterAgentService.name);

  constructor(
    private readonly newsletterWorkflowService: NewsletterWorkflowLanggraphService,
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

  async *generateNewsletterStream(
    input: NewsletterWorkflowInput,
  ): AsyncGenerator<StreamEvent, void, unknown> {
    this.logger.log('🌊 Starting LangGraph streaming newsletter generation');

    const startTime = Date.now();
    let finalResult: any = null;

    try {
      // Map of LangGraph node names to NodeName enum
      const nodeMapping: Record<string, string> = {
        prepareScrapContent: NodeName.PREPARE_SCRAP,
        processPdfContent: NodeName.PROCESS_PDF,
        aggregator: NodeName.AGGREGATOR,
        generateNewsletter: NodeName.GENERATE_NEWSLETTER,
        articleReflector: NodeName.ARTICLE_REFLECTOR,
        rewriteWritingStyle: NodeName.REWRITE_STYLE,
        generateTitle: NodeName.GENERATE_TITLE,
      };

      const progressMapping: Record<string, number> = {
        prepareScrapContent: 20,
        processPdfContent: 35,
        aggregator: 45,
        generateNewsletter: 65,
        articleReflector: 70,
        rewriteWritingStyle: 85,
        generateTitle: 85,
      };

      // Emit initial progress
      yield {
        type: EventType.PROGRESS,
        timestamp: Date.now(),
        node: 'workflow',
        message_ko: `뉴스레터 생성을 시작합니다: ${input.topic}`,
        message_en: `Starting newsletter generation: ${input.topic}`,
        progress: 0,
        metadata: {
          topic: input.topic,
          scraps_count: input.scrapsWithComments?.length || 0,
          has_pdfs: (input.pdfUrlsWithPrompts?.length || 0) > 0,
        },
      };

      // Stream directly from LangGraph
      const stream = this.newsletterWorkflowService.streamNewsletter(input);
      const startedTaskIds = new Set<string>();
      const nodeStartCounts = new Map<string, number>();
      const nodeCompleteCounts = new Map<string, number>();

      const markNodeStart = (node: string) => {
        nodeStartCounts.set(node, (nodeStartCounts.get(node) ?? 0) + 1);
      };

      const markNodeComplete = (node: string) => {
        nodeCompleteCounts.set(node, (nodeCompleteCounts.get(node) ?? 0) + 1);
      };

      const hasPendingStart = (node: string) => {
        return (nodeStartCounts.get(node) ?? 0) > (nodeCompleteCounts.get(node) ?? 0);
      };

      for await (const event of stream) {
        this.logger.debug(
          `📦 Received event from LangGraph [${event.event}]: ${JSON.stringify(event).substring(0, 120)}`,
        );

        if (event.event === 'error') {
          yield {
            type: EventType.ERROR,
            timestamp: Date.now(),
            message:
              (event.data as { message?: string })?.message ||
              'LangGraph streaming error',
            error_type: 'LangGraphStreamError',
          };
          continue;
        }

        if (event.event === 'task_update') {
          const tasks = Array.isArray(event.data) ? event.data : [event.data];
          for (const task of tasks) {
            if (!task || typeof task !== 'object') continue;
            const actualNodeName = task.name as string | undefined;
            if (!actualNodeName) continue;

            const taskId = task.id as string | undefined;
            if (taskId && startedTaskIds.has(taskId)) {
              continue;
            }

            const legacyNodeName = nodeMapping[actualNodeName] || actualNodeName;
            const messageConfig = NODE_MESSAGES[legacyNodeName as NodeName];

            yield {
              type: EventType.NODE_START,
              timestamp: Date.now(),
              node: legacyNodeName,
              message_ko: messageConfig?.start_ko || `${legacyNodeName} 시작`,
              message_en: messageConfig?.start_en || `Starting ${legacyNodeName}`,
            };

            markNodeStart(legacyNodeName);
            if (taskId) {
              startedTaskIds.add(taskId);
            }
          }
          continue;
        }

        const nodeData = event.data as any;
        if (!nodeData || typeof nodeData !== 'object') continue;

        const actualNodeName = Object.keys(nodeData)[0];
        if (!actualNodeName) continue;

        const legacyNodeName = nodeMapping[actualNodeName] || actualNodeName;
        const progressData = nodeData[actualNodeName];
        const nodeMessages = NODE_MESSAGES[legacyNodeName as NodeName];

        this.logger.log(
          `✅ Node completed: ${legacyNodeName} at ${new Date().toISOString()}`,
        );

        if (!hasPendingStart(legacyNodeName)) {
          yield {
            type: EventType.NODE_START,
            timestamp: Date.now(),
            node: legacyNodeName,
            message_ko: nodeMessages?.start_ko || `${legacyNodeName} 시작`,
            message_en: nodeMessages?.start_en || `Starting ${legacyNodeName}`,
          };
          markNodeStart(legacyNodeName);
        }

        // Extract metadata
        const metadata: Record<string, unknown> = {};
        if (actualNodeName === 'prepareScrapContent') {
          metadata.scrap_count = progressData?.scrapsWithComments?.length || 0;
        } else if (actualNodeName === 'processPdfContent') {
          metadata.pdf_count = progressData?.pdfUrlsWithPrompts?.length || 0;
        } else if (actualNodeName === 'generateNewsletter') {
          metadata.content_length = progressData?.content?.length || 0;
        }

        // Emit PROGRESS
        yield {
          type: EventType.PROGRESS,
          timestamp: Date.now(),
          node: legacyNodeName,
          message_ko: nodeMessages?.complete_ko || `${legacyNodeName} 완료`,
          message_en: nodeMessages?.complete_en || `${legacyNodeName} completed`,
          progress: progressMapping[actualNodeName] || 0,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        };

        // Emit NODE_COMPLETE (for frontend compatibility)
        yield {
          type: EventType.NODE_COMPLETE,
          timestamp: Date.now(),
          node: legacyNodeName,
          result: metadata,
          duration: 0,
          message: nodeMessages?.complete_en || `${legacyNodeName} completed`,
        };
        markNodeComplete(legacyNodeName);

        // Collect final result, always prefer the latest content/title updates
        if (
          progressData?.content ||
          progressData?.title ||
          progressData?.analysisReason ||
          progressData?.warnings
        ) {
          if (!finalResult) {
            finalResult = {};
          }

          if (progressData?.content) {
            finalResult.content = progressData.content;
          }
          if (progressData?.title) {
            finalResult.title = progressData.title;
          }
          if (progressData?.analysisReason) {
            finalResult.analysisReason = progressData.analysisReason;
          }
          if (progressData?.warnings) {
            finalResult.warnings = progressData.warnings;
          }
        }
      }

      this.logger.log('🎉 LangGraph streaming completed');

      // Emit workflow complete
      yield {
        type: EventType.PROGRESS,
        timestamp: Date.now(),
        node: 'workflow',
        message_ko: '뉴스레터 생성을 완료했습니다.',
        message_en: 'Newsletter generation complete.',
        progress: 100,
      };

      // Emit final COMPLETE event
      if (finalResult) {
        yield {
          type: EventType.COMPLETE,
          timestamp: Date.now(),
          title: finalResult.title || '',
          content: finalResult.content || '',
          analysis_reason: finalResult.analysisReason || 'AI model generated newsletter.',
          warnings: finalResult.warnings || [],
          total_duration: (Date.now() - startTime) / 1000,
        };
      } else {
        // Fallback to synchronous generation
        this.logger.warn('⚠️ No final result from streaming, executing synchronously');
        const result = await this.newsletterWorkflowService.generateNewsletter(input);
        yield {
          type: EventType.COMPLETE,
          timestamp: Date.now(),
          title: result.title,
          content: result.content,
          analysis_reason: result.analysisReason,
          warnings: result.warnings || [],
          total_duration: (Date.now() - startTime) / 1000,
        };
      }
    } catch (error) {
      this.logger.error('❌ Streaming newsletter generation failed:', error);
      yield {
        type: EventType.ERROR,
        timestamp: Date.now(),
        message: (error as Error).message,
        error_type: (error as Error).name,
      };
      throw error;
    }
  }

  async regenerateArticle(
    input: RegenerateArticleInput,
  ): Promise<RegenerateArticleOutput> {
    this.logger.log('🔄 Regenerating article locally');
    return this.articleRegeneratorService.regenerateArticle(input);
  }
}
