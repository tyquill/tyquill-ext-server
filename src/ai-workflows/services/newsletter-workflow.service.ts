import { Injectable, Logger } from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { ChatVertexAI } from '@langchain/google-vertexai';
import { z } from 'zod';

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
import { NodeName } from '../models/streaming';

const VERTEX_MODEL_NEWSLETTER = 'gemini-2.5-flash';
const VERTEX_MODEL_TITLE = 'gemini-2.5-flash';
const VERTEX_MODEL_REFLECTOR = 'gemini-2.5-flash';
const VERTEX_MODEL_REWRITE = 'gemini-2.5-flash';
const VERTEX_MODEL_PDF = 'gemini-2.0-flash-lite';

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const PDF_DOWNLOAD_TIMEOUT_MS = 60_000;

export interface WorkflowState {
  topic: string;
  keyInsight: string;
  generationParams: string;
  articleStructureTemplate: SectionTemplate[];
  writingStyleExampleContents: string[];
  scrapsWithComments: ScrapWithComment[];
  pdfUrlsWithPrompts: PdfReference[];
  scrapContent: string;
  pdfContent: string;
  feedbacks: Feedback[];
  countOfReflector: number;
  processingSteps: string[];
  warnings: string[];
  errors: string[];
  title: string;
  content: string;
  analysisReason: string;
  userLanguage: string; // 'ko' for Korean, 'en' for English
}

export type WorkflowUpdate = Partial<WorkflowState> & {
  processingSteps?: string[];
  warnings?: string[];
  errors?: string[];
  feedbacks?: Feedback[];
};


const LIST_MERGE_KEYS = new Set<keyof WorkflowState>([
  'processingSteps',
  'warnings',
  'errors',
  'feedbacks',
]);

const PAGE_STRUCTURE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          level: { type: 'integer' },
          parent_index: {
            anyOf: [{ type: 'integer' }, { type: 'null' }],
          },
        },
        required: ['title', 'level'],
        additionalProperties: false,
      },
    },
  },
  required: ['sections'],
  additionalProperties: false,
} as const;

@Injectable()
export class NewsletterWorkflowService {
  protected readonly logger = new Logger(NewsletterWorkflowService.name);

  private readonly newsletterModel: ChatVertexAI;
  private readonly titleModel: ChatVertexAI;
  private readonly reflectorModel: ChatVertexAI;
  private readonly rewriteModel: ChatVertexAI;
  private readonly pdfModel: ChatVertexAI;

  constructor(
    private readonly vertexFactory: VertexAiFactory,
    private readonly scrapCombinationService: ScrapCombinationService,
    private readonly promptTemplates: NewsletterPromptTemplatesService,
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
      userLanguage: input.userLanguage ?? 'en', // Default to English
    };
  }

  protected applyStateUpdate(
    state: WorkflowState,
    update: WorkflowUpdate | undefined,
  ): void {
    if (!update) {
      return;
    }

    const stateRecord = state as Record<
      keyof WorkflowState,
      WorkflowState[keyof WorkflowState]
    >;

    Object.entries(update).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }

      const typedKey = key as keyof WorkflowState;

      if (LIST_MERGE_KEYS.has(typedKey)) {
        const current = stateRecord[typedKey];
        const currentArray = Array.isArray(current) ? current : [];
        const nextArray = Array.isArray(value) ? value : [value];
        stateRecord[typedKey] = [
          ...currentArray,
          ...nextArray,
        ] as WorkflowState[typeof typedKey];
        return;
      }

      stateRecord[typedKey] = value as WorkflowState[typeof typedKey];
    });
  }

  protected async runWorkflow(state: WorkflowState): Promise<void> {
    this.applyStateUpdate(state, await this.prepareScrapContentNode(state));
    this.applyStateUpdate(state, await this.processPdfContentNode(state));
    this.applyStateUpdate(state, this.aggregatorNode(state));
    await this.generateWithIterations(state);
    this.applyStateUpdate(state, await this.generateTitleNode(state));
    // adaptLocaleNode removed: userLanguage now determines language from the start
  }

  protected async generateWithIterations(state: WorkflowState): Promise<void> {
    this.applyStateUpdate(state, await this.generateNewsletterNode(state));

    let next = this.determineNextNode(state);
    while (next !== NodeName.GENERATE_TITLE) {
      if (next === NodeName.ARTICLE_REFLECTOR) {
        this.applyStateUpdate(state, await this.articleReflectorNode(state));
        this.applyStateUpdate(state, await this.generateNewsletterNode(state));
      } else if (next === NodeName.REWRITE_STYLE) {
        this.applyStateUpdate(state, await this.rewriteWritingStyleNode(state));
        break;
      } else {
        break;
      }

      next = this.determineNextNode(state);
    }
  }

  async generateNewsletter(
    input: NewsletterWorkflowInput,
  ): Promise<NewsletterWorkflowOutput> {
    const state = this.createInitialState(input);

    await this.runWorkflow(state);

    if (state.errors.length > 0) {
      throw new Error(state.errors.join(', '));
    }

    return {
      title: state.title,
      content: state.content,
      analysisReason: state.analysisReason || 'AI system generated newsletter.',
      warnings: state.warnings,
    };
  }

  async analyzePageStructure(content: string): Promise<PageStructureAnalysis> {
    try {
      const template = this.promptTemplates.getStructureAnalysisTemplate();
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
        const template = this.promptTemplates.getStructureAnalysisTemplate();
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

  protected async prepareScrapContentNode(
    state: WorkflowState,
  ): Promise<WorkflowUpdate> {
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
  ): Promise<WorkflowUpdate> {
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
  ): Promise<WorkflowUpdate> {
    try {
      const feedbacks = state.feedbacks ?? [];
      const articleStructure = state.articleStructureTemplate ?? [];
      const isKorean = state.userLanguage === 'ko';

      const template = isKorean
        ? this.promptTemplates.getKoreanNewsletterTemplate()
        : this.promptTemplates.getSimpleNewsletterTemplate();

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
  ): Promise<WorkflowUpdate> {
    try {
      const isKorean = state.userLanguage === 'ko';

      const template = isKorean
        ? this.promptTemplates.getKoreanNewsletterTitleTemplate()
        : this.promptTemplates.getSimpleNewsletterTitleTemplate();

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
  ): Promise<WorkflowUpdate> {
    try {
      const isKorean = state.userLanguage === 'ko';

      const template = isKorean
        ? this.promptTemplates.getKoreanArticleReflectorTemplate()
        : this.promptTemplates.getArticleReflectorTemplate();

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
  ): Promise<WorkflowUpdate> {
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
        ? this.promptTemplates.getKoreanWritingStyleRewriteTemplate()
        : this.promptTemplates.getWritingStyleRewriteTemplate();

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

  protected aggregatorNode(state: WorkflowState): WorkflowUpdate {
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
