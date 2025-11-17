import { Injectable } from '@nestjs/common';

import { NewsletterWorkflowInput } from '../dto/newsletter.dto';
import { EventType, NodeName, StreamEvent } from '../models/streaming';
import { StreamingService } from './streaming.service';
import {
  NewsletterWorkflowService,
  WorkflowState,
} from './newsletter-workflow.service';

@Injectable()
export class NewsletterStreamingService extends NewsletterWorkflowService {

  async *generateNewsletterStream(
    input: NewsletterWorkflowInput,
  ): AsyncGenerator<StreamEvent, void, unknown> {
    const streaming = new StreamingService();
    await streaming.start();

    const state = this.createInitialState(input);

    const runWorkflow = async () => {
      try {
        streaming.emitProgress({
          node: 'workflow',
          message_ko: `뉴스레터 생성을 시작합니다: ${input.topic}`,
          message_en: `Starting newsletter generation: ${input.topic}`,
          progress: 0,
          metadata: {
            topic: input.topic,
            scraps_count: state.scrapsWithComments?.length ?? 0,
            has_pdfs: (state.pdfUrlsWithPrompts?.length ?? 0) > 0,
          },
        });

        await this.runStep(streaming, NodeName.PREPARE_SCRAP, async () => {
          const update = await this.prepareScrapContentNode(state);
          this.applyStateUpdate(state, update);
          streaming.emitProgress({
            node: NodeName.PREPARE_SCRAP,
            message_ko: '웹 스크랩 데이터를 정리했습니다.',
            message_en: 'Scrap data prepared.',
            progress: 20,
            metadata: {
              scrap_count: state.scrapsWithComments?.length ?? 0,
            },
          });
        });

        await this.runStep(streaming, NodeName.PROCESS_PDF, async () => {
          const update = await this.processPdfContentNode(state);
          this.applyStateUpdate(state, update);
          streaming.emitProgress({
            node: NodeName.PROCESS_PDF,
            message_ko: 'PDF 자료를 분석했습니다.',
            message_en: 'PDF documents analyzed.',
            progress: 35,
            metadata: {
              pdf_count: state.pdfUrlsWithPrompts?.length ?? 0,
            },
          });
        });

        await this.runStep(streaming, NodeName.AGGREGATOR, async () => {
          const update = this.aggregatorNode(state);
          this.applyStateUpdate(state, update);
          streaming.emitProgress({
            node: NodeName.AGGREGATOR,
            message_ko: '콘텐츠를 통합하고 있습니다.',
            message_en: 'Aggregating content.',
            progress: 45,
          });
        });

        await this.runIterationsWithStreaming(streaming, state);

        await this.runStep(streaming, NodeName.GENERATE_TITLE, async () => {
          const update = await this.generateTitleNode(state);
          this.applyStateUpdate(state, update);
          streaming.emitProgress({
            node: NodeName.GENERATE_TITLE,
            message_ko: '제목을 생성했습니다.',
            message_en: 'Title generated.',
            progress: 85,
          });
        });

        // adaptLocaleNode removed: userLanguage now determines language from the start

        streaming.emitProgress({
          node: 'workflow',
          message_ko: '뉴스레터 생성을 완료했습니다.',
          message_en: 'Newsletter generation complete.',
          progress: 100,
        });

        streaming.emitComplete({
          title: state.title ?? '',
          content: state.content ?? '',
          analysis_reason:
            state.analysisReason ?? 'AI system generated newsletter.',
          warnings: Array.isArray(state.warnings) ? state.warnings : [],
        });
      } catch (error) {
        this.logger.error('Streaming workflow failed', error as Error);
        streaming.emitError({
          message: (error as Error)?.message ?? 'Streaming failed',
          error_type: (error as Error)?.name ?? 'Error',
        });
      }
    };

    void runWorkflow();

    for await (const event of streaming.events()) {
      yield event;
    }
  }

  private async runStep(
    streaming: StreamingService,
    node: NodeName,
    task: () => Promise<void>,
  ): Promise<void> {
    streaming.emitNodeStart(node);
    try {
      await task();
      streaming.emitNodeComplete(node);
    } catch (error) {
      streaming.emitError({
        message: (error as Error)?.message ?? 'Node execution failed',
        node,
        error_type: (error as Error)?.name ?? 'Error',
      });
      throw error;
    }
  }

  private async runIterationsWithStreaming(
    streaming: StreamingService,
    state: WorkflowState,
  ) {
    await this.runStep(streaming, NodeName.GENERATE_NEWSLETTER, async () => {
      const update = await this.generateNewsletterNode(state);
      this.applyStateUpdate(state, update);
      streaming.emitProgress({
        node: NodeName.GENERATE_NEWSLETTER,
        message_ko: '뉴스레터 초안을 생성했습니다.',
        message_en: 'Generated newsletter draft.',
        progress: 65,
        metadata: {
          content_length: state.content?.length ?? 0,
        },
      });
    });

    let next = this.determineNextNode(state);

    while (next !== NodeName.GENERATE_TITLE) {
      if (next === NodeName.ARTICLE_REFLECTOR) {
        await this.runStep(streaming, NodeName.ARTICLE_REFLECTOR, async () => {
          const update = await this.articleReflectorNode(state);
          this.applyStateUpdate(state, update);
        });

        await this.runStep(streaming, NodeName.GENERATE_NEWSLETTER, async () => {
          const update = await this.generateNewsletterNode(state);
          this.applyStateUpdate(state, update);
          streaming.emitProgress({
            node: NodeName.GENERATE_NEWSLETTER,
            message_ko: '뉴스레터 품질을 개선했습니다.',
            message_en: 'Improved newsletter quality.',
            progress: Math.min(80, (state.countOfReflector ?? 0) * 20 + 60),
            metadata: {
              iteration: state.countOfReflector ?? 0,
              content_length: state.content?.length ?? 0,
            },
          });
        });
      } else if (next === NodeName.REWRITE_STYLE) {
        await this.runStep(streaming, NodeName.REWRITE_STYLE, async () => {
          const update = await this.rewriteWritingStyleNode(state);
          this.applyStateUpdate(state, update);
        });
        break;
      } else {
        break;
      }

      next = this.determineNextNode(state);
    }
  }
}
