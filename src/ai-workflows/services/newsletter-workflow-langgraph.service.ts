import { Injectable, Logger } from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { ChatVertexAI } from '@langchain/google-vertexai';
import { z } from 'zod';
import { StateGraph, END, Annotation } from '@langchain/langgraph';

import {
  Feedback,
  NewsletterWorkflowInput,
  NewsletterWorkflowOutput,
  PageStructureAnalysis,
  PageStructureSchema,
  PdfReference,
  ScrapWithComment,
  SectionTemplate,
} from '../dto/newsletter.dto';
import { NewsletterPromptTemplatesService } from '../prompts/newsletter-prompt-templates.service';
import { ScrapCombinationService } from './scrap-combination.service';
import { VertexAiFactory } from './vertex-ai.factory';
import { LangfuseService } from './langfuse.service';
import { NodeName } from '../models/streaming';

const VERTEX_MODEL_NEWSLETTER = 'gemini-2.5-flash';
const VERTEX_MODEL_TITLE = 'gemini-2.5-flash';
const VERTEX_MODEL_REFLECTOR = 'gemini-2.5-flash';
const VERTEX_MODEL_REWRITE = 'gemini-2.5-flash';
const VERTEX_MODEL_PDF = 'gemini-2.0-flash-lite';

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const PDF_DOWNLOAD_TIMEOUT_MS = 60_000;

// Define WorkflowState using LangGraph Annotation
const WorkflowStateAnnotation = Annotation.Root({
  topic: Annotation<string>,
  keyInsight: Annotation<string>,
  generationParams: Annotation<string>,
  articleStructureTemplate: Annotation<SectionTemplate[]>,
  writingStyleExampleContents: Annotation<string[]>,
  scrapsWithComments: Annotation<ScrapWithComment[]>,
  pdfUrlsWithPrompts: Annotation<PdfReference[]>,
  scrapContent: Annotation<string>,
  pdfContent: Annotation<string>,
  feedbacks: Annotation<Feedback[]>({
    reducer: (current, update) => [...(current || []), ...(update || [])],
  }),
  countOfReflector: Annotation<number>,
  processingSteps: Annotation<string[]>({
    reducer: (current, update) => [...(current || []), ...(update || [])],
  }),
  warnings: Annotation<string[]>({
    reducer: (current, update) => [...(current || []), ...(update || [])],
  }),
  errors: Annotation<string[]>({
    reducer: (current, update) => [...(current || []), ...(update || [])],
  }),
  title: Annotation<string>,
  content: Annotation<string>,
  analysisReason: Annotation<string>,
  userLanguage: Annotation<string>,
});

type WorkflowState = typeof WorkflowStateAnnotation.State;

@Injectable()
export class NewsletterWorkflowLanggraphService {
  protected readonly logger = new Logger(NewsletterWorkflowLanggraphService.name);

  private readonly newsletterModel: ChatVertexAI;
  private readonly titleModel: ChatVertexAI;
  private readonly reflectorModel: ChatVertexAI;
  private readonly rewriteModel: ChatVertexAI;
  private readonly pdfModel: ChatVertexAI;

  private compiledWorkflow: ReturnType<typeof this.buildWorkflow>;

  constructor(
    private readonly vertexFactory: VertexAiFactory,
    private readonly scrapCombinationService: ScrapCombinationService,
    private readonly promptTemplates: NewsletterPromptTemplatesService,
    private readonly langfuseService: LangfuseService,
  ) {
    this.newsletterModel = this.vertexFactory.buildChat({
      model: VERTEX_MODEL_NEWSLETTER,
      temperature: 0.7,
      thinkingBudget: -1,
      maxOutputTokens: 8192,
    });
    this.titleModel = this.vertexFactory.buildChat({
      model: VERTEX_MODEL_TITLE,
      temperature: 0.5,
      thinkingBudget: -1,
    });
    this.reflectorModel = this.vertexFactory.buildChat({
      model: VERTEX_MODEL_REFLECTOR,
      temperature: 0.3,
      thinkingBudget: -1,
    });
    this.rewriteModel = this.vertexFactory.buildChat({
      model: VERTEX_MODEL_REWRITE,
      temperature: 0.5,
      thinkingBudget: -1,
    });
    this.pdfModel = this.vertexFactory.buildChat({
      model: VERTEX_MODEL_PDF,
      temperature: 0.4,
      thinkingBudget: 0,
    });

    // Build and compile the workflow graph
    this.compiledWorkflow = this.buildWorkflow();

  }


  /**
   * Build the LangGraph workflow
   */
  private buildWorkflow() {
    const workflow = new StateGraph(WorkflowStateAnnotation)
      .addNode('prepareScrapContent', this.prepareScrapContentNode.bind(this))
      .addNode('processPdfContent', this.processPdfContentNode.bind(this))
      .addNode('aggregator', this.aggregatorNode.bind(this))
      .addNode('generateNewsletter', this.generateNewsletterNode.bind(this))
      .addNode('articleReflector', this.articleReflectorNode.bind(this))
      .addNode('rewriteWritingStyle', this.rewriteWritingStyleNode.bind(this))
      .addNode('generateTitle', this.generateTitleNode.bind(this));

    // Parallel execution: Both scrap and PDF processing start from START
    workflow.addEdge('__start__', 'prepareScrapContent');
    workflow.addEdge('__start__', 'processPdfContent');

    // Both nodes feed into aggregator
    workflow.addEdge('prepareScrapContent', 'aggregator');
    workflow.addEdge('processPdfContent', 'aggregator');
    workflow.addEdge('aggregator', 'generateNewsletter');

    // Conditional routing after generateNewsletter
    workflow.addConditionalEdges(
      'generateNewsletter',
      this.determineNextNode.bind(this),
      {
        [NodeName.ARTICLE_REFLECTOR]: 'articleReflector',
        [NodeName.REWRITE_STYLE]: 'rewriteWritingStyle',
        [NodeName.GENERATE_TITLE]: 'generateTitle',
      },
    );

    // Article reflector loops back to generateNewsletter
    workflow.addEdge('articleReflector', 'generateNewsletter');

    // Writing style rewrite goes to title generation
    workflow.addEdge('rewriteWritingStyle', 'generateTitle');

    // Title generation is the final node
    workflow.addEdge('generateTitle', '__end__');

    return workflow.compile();
  }

  /**
   * Generate newsletter using LangGraph workflow
   */
  async generateNewsletter(
    input: NewsletterWorkflowInput,
  ): Promise<NewsletterWorkflowOutput> {
    const startTime = Date.now();
    const initialState = this.createInitialState(input);

    try {
      this.logger.log('🚀 Starting newsletter generation workflow');
      this.logger.log(`📝 Topic: ${input.topic}`);
      this.logger.log(`💡 Key insight: ${input.keyInsight || 'None'}`);
      this.logger.log(`📊 Scraps count: ${input.scrapsWithComments?.length || 0}`);

      // Prepare config with proper metadata for LangSmith graph visualization
      const config: any = {
        runName: 'newsletter-generation-workflow',
        tags: [
          'newsletter',
          'langgraph',
          'production',
          'typescript',
          input.userLanguage || 'en',
        ],
        metadata: {
          topic: input.topic,
          userLanguage: input.userLanguage || 'en',
          scrapsCount: input.scrapsWithComments?.length || 0,
          pdfCount: input.pdfUrlsWithPrompts?.length || 0,
          hasWritingStyle: (input.writingStyleExampleContents?.length || 0) > 0,
          hasArticleStructure: (input.articleStructureTemplate?.length || 0) > 0,
          timestamp: new Date().toISOString(),
        },
      };

      // Add Langfuse CallbackHandler for tracing
      const langfuseHandler = this.langfuseService.createHandler({
        metadata: {
          topic: input.topic,
          userLanguage: input.userLanguage || 'en',
          scrapsCount: input.scrapsWithComments?.length || 0,
        },
        tags: ['newsletter', 'langgraph'],
      });

      if (langfuseHandler) {
        config.callbacks = [langfuseHandler];
        this.logger.log('✅ Langfuse tracing enabled for this workflow');
      }

      // Invoke the compiled workflow
      const finalState = await this.compiledWorkflow.invoke(initialState, config);

      if (finalState.errors && finalState.errors.length > 0) {
        this.logger.error(`❌ Newsletter generation failed: ${finalState.errors.join(', ')}`);
        throw new Error(finalState.errors.join(', '));
      }

      const executionTime = (Date.now() - startTime) / 1000;
      this.logger.log(`🎉 Newsletter generation completed successfully in ${executionTime.toFixed(1)}s`);

      return {
        title: finalState.title,
        content: finalState.content,
        analysisReason: finalState.analysisReason || 'AI system generated newsletter.',
        warnings: finalState.warnings || [],
      };
    } catch (error) {
      const executionTime = (Date.now() - startTime) / 1000;
      this.logger.error(`🚨 Newsletter generation workflow failed after ${executionTime.toFixed(1)}s`, error as Error);
      throw error;
    }
  }

  /**
   * Stream newsletter generation events
   */
  async *streamNewsletter(
    input: NewsletterWorkflowInput,
  ): AsyncGenerator<{ event: string; data: any }> {
    const initialState = this.createInitialState(input);

    try {
      // Prepare config for streaming with LangSmith tracing
      const config: any = {
        runName: 'newsletter-generation-stream',
        tags: [
          'newsletter',
          'langgraph',
          'streaming',
          'typescript',
          input.userLanguage || 'en',
        ],
        metadata: {
          topic: input.topic,
          userLanguage: input.userLanguage || 'en',
          scrapsCount: input.scrapsWithComments?.length || 0,
          pdfCount: input.pdfUrlsWithPrompts?.length || 0,
          timestamp: new Date().toISOString(),
        },
        streamMode: ['updates', 'tasks'],
      };

      // Add Langfuse CallbackHandler for tracing
      const langfuseHandler = this.langfuseService.createHandler({
        metadata: {
          topic: input.topic,
          userLanguage: input.userLanguage || 'en',
          scrapsCount: input.scrapsWithComments?.length || 0,
        },
        tags: ['newsletter', 'langgraph', 'streaming'],
      });

      if (langfuseHandler) {
        config.callbacks = [langfuseHandler];
        this.logger.log('✅ Langfuse tracing enabled for streaming workflow');
      }

      // Stream events from the workflow
      this.logger.log('📡 Starting LangGraph workflow stream...');
      const stream = await this.compiledWorkflow.stream(initialState, config);

      this.logger.log('🔄 Iterating over stream events...');
      for await (const chunk of stream) {
        if (Array.isArray(chunk) && chunk.length === 2 && typeof chunk[0] === 'string') {
          const [mode, payload] = chunk;

          if (mode === 'tasks') {
            this.logger.debug(
              `🧩 TASK EVENT: ${JSON.stringify(payload).substring(0, 100)}`,
            );

            yield {
              event: 'task_update',
              data: Array.isArray(payload) ? payload : [payload],
            };
            continue;
          }

          if (mode === 'updates') {
            const nodeName =
              payload && typeof payload === 'object'
                ? Object.keys(payload)[0]
                : 'unknown';
            this.logger.log(
              `⚡ STREAM UPDATE (${mode}): ${nodeName} at ${new Date().toISOString()}`,
            );

            yield {
              event: 'node_update',
              data: payload,
            };
            continue;
          }

          this.logger.debug(
            `ℹ️ Unsupported LangGraph stream mode received: ${mode}`,
          );
          continue;
        }

        const nodeName =
          chunk && typeof chunk === 'object'
            ? Object.keys(chunk)[0]
            : 'unknown';
        this.logger.log(
          `⚡ STREAMING EVENT: ${nodeName} at ${new Date().toISOString()}`,
        );

        yield {
          event: 'node_update',
          data: chunk,
        };
      }

      this.logger.log('✅ LangGraph stream iteration completed');
    } catch (error) {
      this.logger.error('Newsletter streaming workflow failed', error as Error);
      yield {
        event: 'error',
        data: { message: (error as Error).message },
      };
    }
  }

  protected createInitialState(
    input: NewsletterWorkflowInput,
  ): WorkflowState {
    return {
      topic: input.topic,
      keyInsight: input.keyInsight ?? '',
      generationParams: input.generationParams ?? '',
      articleStructureTemplate: [...(input.articleStructureTemplate ?? [])],
      writingStyleExampleContents: [...(input.writingStyleExampleContents ?? [])],
      scrapsWithComments: [...(input.scrapsWithComments ?? [])],
      pdfUrlsWithPrompts: [...(input.pdfUrlsWithPrompts ?? [])],
      feedbacks: [...(input.feedbacks ?? [])],
      scrapContent: '',
      pdfContent: '',
      processingSteps: [],
      warnings: [],
      errors: [],
      analysisReason: '',
      title: '',
      content: '',
      countOfReflector: 0,
      userLanguage: input.userLanguage ?? 'en',
    };
  }

  protected async prepareScrapContentNode(
    state: WorkflowState,
  ): Promise<Partial<WorkflowState>> {
    try {
      const scraps = state.scrapsWithComments ?? [];
      if (scraps.length === 0) {
        return {
          processingSteps: ['scrap_content_preparation'],
          warnings: ['Scrap data is not provided.'],
          scrapContent:
            'Scrap data is not provided. Proceed with the topic and key insight only.',
        };
      }

      const content =
        await this.scrapCombinationService.formatForAiPromptWithComments(
          scraps,
        );

      return {
        scrapContent: content,
        processingSteps: ['scrap_content_preparation'],
      };
    } catch (error) {
      this.logger.error('Failed to prepare scrap content', error as Error);
      return {
        processingSteps: ['scrap_content_preparation'],
        errors: ['Scrap data preparation error.'],
        warnings: ['Scrap data preparation error.'],
        scrapContent:
          'Scrap data processing failed. Proceed with the basic template.',
      };
    }
  }

  protected async buildPdfMessage(
    promptText: string,
    fileUrl: string,
  ): Promise<HumanMessage> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      PDF_DOWNLOAD_TIMEOUT_MS,
    );

    try {
      const response = await fetch(fileUrl, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(
          `Failed to download PDF from ${fileUrl}: HTTP ${response.status}`,
        );
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > MAX_PDF_SIZE_BYTES) {
        throw new Error('PDF file exceeds 10MB limit');
      }

      const base64 = buffer.toString('base64');

      return new HumanMessage({
        content: [
          { type: 'text', text: promptText },
          {
            type: 'media',
            mimeType: 'application/pdf',
            data: base64,
          },
        ],
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  protected extractMessageText(message: BaseMessage | string): string {
    if (typeof message === 'string') {
      return message;
    }

    const content = (message as AIMessage).content;

    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (!part) {
            return '';
          }
          if (typeof part === 'string') {
            return part;
          }
          if ('text' in part && part.text) {
            return typeof part.text === 'string'
              ? part.text
              : String(part.text ?? '');
          }
          if ('content' in part && part.content) {
            return String(part.content ?? '');
          }
          return '';
        })
        .join('');
    }

    return content ? String(content) : '';
  }

  protected async processSinglePdf(
    pdfItem: PdfReference,
    state: WorkflowState,
  ): Promise<string> {
    const fileUrl = pdfItem.url ?? '';
    const usagePrompt = pdfItem.usagePrompt ?? '';
    const aiContent = pdfItem.aiContent;

    if (aiContent) {
      const prefix = usagePrompt
        ? `**The reason why the user uses the PDF (reference to specific content or how to use it)**: ${usagePrompt}\n\n`
        : '';
      return `<pdf_content>\n${prefix}${aiContent}</pdf_content>`;
    }

    if (!fileUrl) {
      return '[PDF processing failed] URL and text are both missing.';
    }

    try {
      const target = state.topic ?? '';
      const insight = state.keyInsight ?? '';

      const message = await this.buildPdfMessage(
        usagePrompt
          ? `You are a professional PDF document analyzer.\n\nUser request: ${usagePrompt}\nNewsletter topic: ${target}\nKey insight: ${insight}\n\nExtract and analyze the relevant content of the PDF document according to the above request.\n- Extract and analyze the relevant content of the PDF document according to the above request.\n- Explain the content in relation to the newsletter topic.\n- Include specific data, quotes, and cases if they exist.\n- Write in markdown format.\n- Write in English.\n\nWrite only the relevant content and analysis extracted from the PDF.`
          : `You are a professional PDF document summarizer.\n\nNewsletter topic: ${target}\nKey insight: ${insight}\n\nSummarize the content of the PDF document in relation to the newsletter topic.\n- Summarize the core content of the document concisely.\n- Focus on the part related to the newsletter topic.\n- Include important data or statistics if they exist.\n- Write in markdown format.\n- Write in English.\n\nPDF document summary:`,
        fileUrl,
      );

      const response = await this.pdfModel.invoke([message]);
      const text = this.extractMessageText(response);

      if (usagePrompt) {
        return `<pdf_content>\n**The reason why the user uses the PDF (reference to specific content or how to use it)**: ${usagePrompt}\n\n${text}</pdf_content>`;
      }

      return `<pdf_content>\n${text}</pdf_content>`;
    } catch (error) {
      this.logger.error(
        `PDF processing failed for ${fileUrl}`,
        error as Error,
      );
      return `<pdf_content>\n[PDF processing failed] ${fileUrl} - Cannot read the file.\n</pdf_content>`;
    }
  }

  protected async processPdfContentNode(
    state: WorkflowState,
  ): Promise<Partial<WorkflowState>> {
    try {
      const pdfItems = state.pdfUrlsWithPrompts ?? [];
      if (pdfItems.length === 0) {
        return {
          processingSteps: ['pdf_content_processing'],
          pdfContent: 'PDF data is not provided.',
          warnings: ['PDF data is not provided.'],
        };
      }

      const processed = await Promise.all(
        pdfItems.map((item) => this.processSinglePdf(item, state)),
      );

      return {
        pdfContent: `<pdf_content_list>\n${processed.join('\n')}\n</pdf_content_list>`,
        processingSteps: ['pdf_content_processing'],
      };
    } catch (error) {
      this.logger.error('PDF content processing error', error as Error);
      return {
        processingSteps: ['pdf_content_processing'],
        errors: ['PDF content processing error.'],
        warnings: ['PDF processing failed. Proceed with the scrap data only.'],
        pdfContent: 'PDF processing failed.',
      };
    }
  }

  protected async generateNewsletterNode(
    state: WorkflowState,
  ): Promise<Partial<WorkflowState>> {
    try {
      const feedbacks = state.feedbacks ?? [];
      const articleStructure = state.articleStructureTemplate ?? [];
      const isKorean = state.userLanguage === 'ko';

      const template = isKorean
        ? await this.promptTemplates.getKoreanNewsletterTemplate()
        : await this.promptTemplates.getSimpleNewsletterTemplate();

      const prompt = await template.format({
        topic: state.topic ?? '',
        keyInsight: state.keyInsight ?? 'Empty',
        generationParams: state.generationParams ?? 'Empty',
        scrapContent: state.scrapContent ?? 'Empty',
        pdfContent: state.pdfContent ?? 'Empty',
        articleStructureTemplate: JSON.stringify(articleStructure),
        feedbacks:
          feedbacks.length > 0
            ? JSON.stringify(feedbacks, null, 2)
            : 'Empty',
      });

      const response = await this.newsletterModel.invoke(prompt);
      const result = this.extractMessageText(response);

      return {
        content: result,
        analysisReason: 'AI model generated newsletter.',
        processingSteps: ['newsletter_generation'],
        countOfReflector: (state.countOfReflector ?? 0) + 1,
      };
    } catch (error) {
      this.logger.error('Newsletter generation error', error as Error);
      return {
        processingSteps: ['newsletter_generation'],
        errors: ['Newsletter generation failed.'],
      };
    }
  }

  protected async generateTitleNode(
    state: WorkflowState,
  ): Promise<Partial<WorkflowState>> {
    try {
      const isKorean = state.userLanguage === 'ko';

      const template = isKorean
        ? await this.promptTemplates.getKoreanNewsletterTitleTemplate()
        : await this.promptTemplates.getSimpleNewsletterTitleTemplate();

      const prompt = await template.format({
        topic: state.topic ?? '',
        keyInsight: state.keyInsight ?? 'Empty',
        generationParams: state.generationParams ?? 'Empty',
        content: state.content ?? '',
      });
      const response = await this.titleModel.invoke(prompt);
      const result = this.extractMessageText(response);

      return {
        title: result.trim(),
      };
    } catch (error) {
      this.logger.error('Newsletter title generation error', error as Error);
      return {
        title: `${state.topic ?? 'Newsletter'} Newsletter`,
        warnings: ['Title generation failed. Proceed with the basic title.'],
      };
    }
  }

  protected async articleReflectorNode(
    state: WorkflowState,
  ): Promise<Partial<WorkflowState>> {
    try {
      const isKorean = state.userLanguage === 'ko';

      const template = isKorean
        ? await this.promptTemplates.getKoreanArticleReflectorTemplate()
        : await this.promptTemplates.getArticleReflectorTemplate();

      const prompt = await template.format({
        topic: state.topic ?? 'Empty',
        keyInsight: state.keyInsight ?? 'Empty',
        generationParams: state.generationParams ?? 'Empty',
        content: state.content ?? 'Empty',
        articleStructureTemplate: JSON.stringify(
          state.articleStructureTemplate ?? [],
        ),
      });
      const response = await this.reflectorModel.invoke(prompt);
      const result = this.extractMessageText(response);

      const feedback: Feedback = {
        generatedNewsletter: state.content ?? '',
        feedback: result,
      };

      return {
        feedbacks: [feedback],
      };
    } catch (error) {
      this.logger.error('Article reflector error', error as Error);
      return {
        warnings: ['Article reflector execution failed.'],
      };
    }
  }

  protected async rewriteWritingStyleNode(
    state: WorkflowState,
  ): Promise<Partial<WorkflowState>> {
    try {
      const examples = state.writingStyleExampleContents ?? [];
      if (examples.length === 0) {
        return {
          content: state.content ?? '',
          processingSteps: ['writing_style_rewrite'],
          warnings: [
            'No writing style examples provided. Proceed with the original content.',
          ],
        };
      }

      const isKorean = state.userLanguage === 'ko';

      const template = isKorean
        ? await this.promptTemplates.getKoreanWritingStyleRewriteTemplate()
        : await this.promptTemplates.getWritingStyleRewriteTemplate();

      const prompt = await template.format({
        topic: state.topic ?? '',
        keyInsight: state.keyInsight ?? 'Empty',
        content: state.content ?? '',
        writingStyleExamples: examples.join('\n\n---\n\n'),
      });
      const response = await this.rewriteModel.invoke(prompt);
      const result = this.extractMessageText(response);

      return {
        content: result,
        processingSteps: ['writing_style_rewrite'],
      };
    } catch (error) {
      this.logger.error('Writing style rewrite error', error as Error);
      return {
        content: state.content ?? '',
        processingSteps: ['writing_style_rewrite'],
        warnings: ['Writing style rewrite error. Proceed with the original content.'],
        errors: ['Writing style rewrite error.'],
      };
    }
  }

  protected aggregatorNode(state: WorkflowState): Partial<WorkflowState> {
    const scrapContent = state.scrapContent ?? '';
    const pdfContent = state.pdfContent ?? '';
    this.logger.debug(
      `Aggregated scrap content length: ${scrapContent.length}`,
    );
    this.logger.debug(`Aggregated pdf content length: ${pdfContent.length}`);
    return {};
  }

  protected determineNextNode(state: WorkflowState):
    | NodeName.ARTICLE_REFLECTOR
    | NodeName.REWRITE_STYLE
    | NodeName.GENERATE_TITLE {
    const iteration = state.countOfReflector ?? 0;
    const hasWritingStyle =
      (state.writingStyleExampleContents?.length ?? 0) > 0;

    this.logger.log(
      `Conditional edge decision: iteration ${iteration}, has writing style examples: ${hasWritingStyle}`,
    );

    if (iteration < 1) {
      return NodeName.ARTICLE_REFLECTOR;
    }

    if (hasWritingStyle) {
      return NodeName.REWRITE_STYLE;
    }

    return NodeName.GENERATE_TITLE;
  }

  async analyzePageStructure(content: string): Promise<PageStructureAnalysis> {
    try {
      const template = await this.promptTemplates.getStructureAnalysisTemplate();
      const prompt = await template.format({ content });
      const structuredModel = this.newsletterModel.withStructuredOutput(
        PageStructureSchema,
        {
          name: 'PageStructureAnalysis',
          method: 'json_mode',
        },
      );
      const result = await structuredModel.invoke(prompt);
      return this.normalizePageStructureResult(result);
    } catch (error) {
      this.logger.warn(
        'Structured output failed for page structure analysis, attempting fallback',
        error as Error,
      );

      try {
        const template = await this.promptTemplates.getStructureAnalysisTemplate();
        const prompt = await template.format({ content });
        const response = await this.newsletterModel.invoke(prompt);
        const text = this.extractMessageText(response);
        const parsed = this.safeJsonParse(text, PageStructureSchema);
        if (parsed) {
          return parsed;
        }
      } catch (fallbackError) {
        this.logger.error(
          'Page structure analysis fallback failed',
          fallbackError as Error,
        );
      }

      return this.normalizePageStructureResult({
        sections: [
          {
            title: 'Document',
            level: 1,
            parent_index: null,
          },
        ],
      });
    }
  }

  protected safeJsonParse<T>(
    text: string,
    schema: z.ZodSchema<T>,
  ): T | undefined {
    if (!text) {
      return undefined;
    }

    const trimmed = text.trim();
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

    try {
      const parsed = JSON.parse(candidate);
      const result = schema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }
    } catch (error) {
      this.logger.warn(
        'JSON parse failed; attempting fallback extraction',
        error as Error,
      );
    }

    const match = candidate.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        const result = schema.safeParse(parsed);
        if (result.success) {
          return result.data;
        }
      } catch (error) {
        this.logger.warn('Fallback JSON parse failed', error as Error);
      }
    }
    return undefined;
  }

  private normalizePageStructureResult(
    result: PageStructureAnalysis,
  ): PageStructureAnalysis {
    return {
      sections: (result.sections ?? []).map((section, index) => ({
        title: section.title ?? `Section ${index + 1}`,
        level: Number(
          typeof section.level === 'string'
            ? parseInt(section.level, 10)
            : section.level ?? 1,
        ),
        parent_index:
          section.parent_index === undefined
            ? null
            : section.parent_index === null
              ? null
              : Number(section.parent_index),
      })),
    };
  }
}
