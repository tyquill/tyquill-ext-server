import { Injectable, Logger } from '@nestjs/common';
import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import {
  JsonOutputParser,
  StringOutputParser,
} from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import {
  ScrapCombinationService,
  ScrapWithComment,
} from './scrap-combination.service';
import { NewsletterPromptTemplatesService } from './newsletter-prompt-templates.service';
import {
  AI_MODELS_CONFIG,
  createModelInitConfig,
  APIKeyValidationError,
} from './config/ai-models.config';
import { SectionTemplate } from 'src/types/section-template';
import { writeFileSync } from 'fs';


/**
 * 피드백 데이터 타입
 */
interface Feedback {
  generatedNewsletter: string;
  feedback: string;
}

/**
 * 뉴스레터 워크플로우 상태 타입
 */
export const NewsletterStateAnnotation = Annotation.Root({
  // 입력 데이터
  topic: Annotation<string>,
  keyInsight: Annotation<string | undefined>,
  scrapsWithComments: Annotation<ScrapWithComment[]>,
  generationParams: Annotation<string | undefined>,
  articleStructureTemplate: Annotation<SectionTemplate[] | undefined>,
  writingStyleExampleContents: Annotation<string[] | undefined>,
  // 중간 처리 데이터
  scrapContent: Annotation<string>,
  countOfReflector: Annotation<number>,
  feedbacks: Annotation<Feedback[]>,
  
  // 최종 결과
  title: Annotation<string>,
  content: Annotation<string>,
  
  // 메타데이터
  processingSteps: Annotation<string[]>,
  warnings: Annotation<string[]>,
  errors: Annotation<string[]>,
});

/**
 * 뉴스레터 입력 인터페이스
 */
export interface NewsletterInput {
  topic: string;
  keyInsight?: string;
  scrapsWithComments: ScrapWithComment[];
  generationParams?: string;
  articleStructureTemplate?: SectionTemplate[];
  writingStyleExampleContents?: string[];
}

/**
 * 뉴스레터 출력 인터페이스
 */
export interface NewsletterOutput {
  title: string;
  content: string;
  analysisReason: string;
  warnings: string[];
}

/**
 * 노드 실행 결과 타입
 */
interface NodeResult {
  [key: string]: any;
  processingSteps?: string[];
  warnings?: string[];
  errors?: string[];
}

/**
 * 뉴스레터 워크플로우 서비스
 */
@Injectable()
export class NewsletterWorkflowService {
  private readonly logger = new Logger(NewsletterWorkflowService.name);
  private model!: ChatGoogleGenerativeAI;
  private titleModel!: ChatGoogleGenerativeAI;
  private reflectorModel!: ChatGoogleGenerativeAI;
  private rewriteModel!: ChatGoogleGenerativeAI;
  private graph: any;

  constructor(
    private readonly scrapCombinationService: ScrapCombinationService,
    private readonly promptTemplatesService: NewsletterPromptTemplatesService,
  ) {
    this.initializeModels();
    this.initializeGraph();
  }

  /**
   * AI 모델 초기화
   */
  private initializeModels(): void {
    try {
      this.logger.log('🤖 Initializing AI models for newsletter workflow...');

      // 메인 모델 (뉴스레터 생성용)
      this.model = new ChatGoogleGenerativeAI(
        createModelInitConfig(AI_MODELS_CONFIG.workflow.main),
      );

      // 제목 생성 전용 모델 (더 빠른 응답)
      this.titleModel = new ChatGoogleGenerativeAI(
        createModelInitConfig({
          ...AI_MODELS_CONFIG.workflow.main,
          model: 'gemini-2.5-flash',
        }),
      );

      // 리플렉터 모델 (분석용)
      this.reflectorModel = new ChatGoogleGenerativeAI(
        createModelInitConfig({
          ...AI_MODELS_CONFIG.workflow.main,
          model: 'gemini-2.5-flash',
        }),
      );

      // rewrite 모델
      this.rewriteModel = new ChatGoogleGenerativeAI(
        createModelInitConfig({
          ...AI_MODELS_CONFIG.workflow.main,
          model: 'gemini-2.5-pro',
        }),
      );

      this.logger.log('✅ AI models initialized successfully');
    } catch (error) {
      if (error instanceof APIKeyValidationError) {
        this.logger.error(`❌ Model initialization failed: ${error.message}`);
        throw new Error(`Failed to initialize AI models: ${error.message}`);
      }
      this.logger.error('❌ Unexpected error during model initialization:', error);
      throw error;
    }
  }

  /**
   * LangGraph 워크플로우 초기화
   */
  private async initializeGraph(): Promise<any> {
    try {
      this.logger.log('🔄 Initializing newsletter workflow graph...');

      const graphBuilder = new StateGraph(NewsletterStateAnnotation)
        .addNode('prepare_scrap_content', this.prepareScrapContentNode.bind(this))
        .addNode('generate_newsletter', this.generateNewsletterNode.bind(this))
        .addNode('generate_newsletter_title', this.generateNewsletterTitleNode.bind(this))
        .addNode('article_reflector', this.articleReflectorNode.bind(this))
        .addNode('rewrite_writing_style', this.rewriteWritingStyleNode.bind(this))
        // 워크플로우 엣지 정의
        .addEdge(START, 'prepare_scrap_content')
        .addEdge('prepare_scrap_content', 'generate_newsletter')
        .addEdge('article_reflector', 'generate_newsletter')
        .addConditionalEdges('generate_newsletter', this.conditionalEdges.bind(this))
        .addEdge('rewrite_writing_style', 'generate_newsletter_title')
        .addEdge('generate_newsletter_title', END);

      this.graph = graphBuilder.compile();
      this.logger.log('✅ Newsletter workflow graph compiled successfully');

      // 그래프 시각화는 선택적으로 실행 (실패해도 애플리케이션은 계속 실행)
      await this.generateGraphVisualization();
    } catch (error) {
      this.logger.error('❌ Failed to initialize workflow graph:', error);
      throw error;
    }
  }

  /**
   * 워크플로우 그래프 시각화 생성 (선택적 기능)
   */
  private async generateGraphVisualization(): Promise<void> {
    try {
      this.logger.log('🎨 Generating workflow graph visualization...');
      
      const representation = this.graph.getGraph();
      const image = await representation.drawMermaidPng();
      const graphStateArrayBuffer = await image.arrayBuffer();
      
      const filePath = "./graphState.png";
      writeFileSync(filePath, new Uint8Array(graphStateArrayBuffer));
      
      this.logger.log('✅ Graph visualization saved successfully');
    } catch (error) {
      this.logger.warn('⚠️ Failed to generate graph visualization (non-critical):', error);
      this.logger.warn('📝 This is likely due to Mermaid.INK API being temporarily unavailable');
      this.logger.warn('🔄 Newsletter workflow will continue to function normally');
    }
  }

  /**
   * 스크랩 데이터 준비 노드
   */
  private async prepareScrapContentNode(
    state: typeof NewsletterStateAnnotation.State,
  ): Promise<NodeResult> {
    const processingSteps = [
      ...(state.processingSteps || []),
      'scrap_content_preparation',
    ];

    try {
      if (!state.scrapsWithComments?.length) {
        return {
          processingSteps,
          warnings: [
            ...(state.warnings || []),
            '스크랩 데이터가 제공되지 않았습니다.',
          ],
          scrapContent: '스크랩 데이터 없음. 주제와 핵심 인사이트만으로 진행합니다.',
        };
      }

      const scrapContent = await this.scrapCombinationService.formatForAiPromptWithComments(
        state.scrapsWithComments,
      );

      return {
        scrapContent,
        processingSteps,
      };
    } catch (error) {
      this.logger.error('스크랩 데이터 준비 오류:', error);
      return {
        processingSteps,
        errors: [
          ...(state.errors || []),
          '스크랩 데이터를 준비하는 중 오류가 발생했습니다.',
        ],
        scrapContent: '스크랩 데이터 처리 실패. 기본 템플릿으로 진행합니다.',
      };
    }
  }

  /**
   * 뉴스레터 생성 노드
   */
  private async generateNewsletterNode(
    state: typeof NewsletterStateAnnotation.State,
  ): Promise<NodeResult> {
    const processingSteps = [
      ...(state.processingSteps || []),
      'newsletter_generation',
    ];

    try {
      this.logger.log(`📝 Generating newsletter (iteration: ${(state.countOfReflector || 0) + 1})`);

      const template = this.promptTemplatesService.getSimpleNewsletterTemplate();
      const chain = template.pipe(this.model).pipe(new StringOutputParser());

      const result = await chain.invoke({
        topic: state.topic,
        keyInsight: state.keyInsight || '없음',
        generationParams: state.generationParams || '없음',
        scrapContent: state.scrapContent || '없음',
        articleStructureTemplate: state.articleStructureTemplate || '없음',
        feedbacks: state.feedbacks?.length ? JSON.stringify(state.feedbacks) : '없음',
      });

      return {
        content: result,
        analysisReason: 'AI 모델로 생성된 뉴스레터입니다.',
        processingSteps,
        countOfReflector: (state.countOfReflector || 0) + 1,
      };
    } catch (error) {
      this.logger.error('뉴스레터 생성 오류:', error);
      return {
        processingSteps,
        errors: [
          ...(state.errors || []),
          '뉴스레터 생성 중 오류가 발생했습니다.',
        ],
        content: `${state.topic}에 대한 기본 뉴스레터 내용입니다.`,
      };
    }
  }

  /**
   * 뉴스레터 제목 생성 노드
   */
  private async generateNewsletterTitleNode(
    state: typeof NewsletterStateAnnotation.State,
  ): Promise<NodeResult> {
    try {
      this.logger.log('📝 Generating newsletter title');

      const template = this.promptTemplatesService.getSimpleNewsletterTitleTemplate();
      const chain = template.pipe(this.titleModel).pipe(new StringOutputParser());

      const result = await chain.invoke({
        topic: state.topic,
        keyInsight: state.keyInsight || '없음',
        generationParams: state.generationParams || '없음',
        content: state.content,
      });

      return {
        title: result.trim(),
      };
    } catch (error) {
      this.logger.error('뉴스레터 제목 생성 오류:', error);
      return {
        title: `${state.topic} 뉴스레터`,
        warnings: [
          ...(state.warnings || []),
          '제목 생성에 실패하여 기본 제목을 사용합니다.',
        ],
      };
    }
  }

  /**
   * 아티클 리플렉터 노드 (품질 개선)
   */
  private async articleReflectorNode(
    state: typeof NewsletterStateAnnotation.State,
  ): Promise<NodeResult> {
    try {
      this.logger.log(`🔍 Running article reflector (iteration: ${state.countOfReflector})`);

      const template = this.promptTemplatesService.getArticleReflectorTemplate();
      const chain = template.pipe(this.reflectorModel).pipe(new StringOutputParser());

      const result = await chain.invoke({
        topic: state.topic || '없음',
        keyInsight: state.keyInsight || '없음',
        generationParams: state.generationParams || '없음',
        content: state.content || '없음',
        articleStructureTemplate: state.articleStructureTemplate || '없음',
      });

      const feedback: Feedback = {
        generatedNewsletter: state.content,
        feedback: result,
      };

      return {
        feedbacks: [...(state.feedbacks || []), feedback],
      };
    } catch (error) {
      this.logger.error('아티클 리플렉터 오류:', error);
      return {
        feedbacks: state.feedbacks || [],
        warnings: [
          ...(state.warnings || []),
          '아티클 리플렉터 실행에 실패했습니다.',
        ],
      };
    }
  }

  /**
   * 조건부 엣지 결정
   */
  private conditionalEdges(
    state: typeof NewsletterStateAnnotation.State,
  ): string {
    const currentIteration = state.countOfReflector || 0;
    const hasWritingStyleExamples = state.writingStyleExampleContents && state.writingStyleExampleContents.length > 0;
    
    this.logger.log(`🔍 Conditional edge decision: iteration ${currentIteration}, has writing style examples: ${hasWritingStyleExamples}`);

    // 반복 횟수가 3 미만이면 리플렉터로
    if (currentIteration < 3) {
      return 'article_reflector';
    }
    
    // 반복 완료 후, 문체 예시가 있으면 문체 재작성으로, 없으면 제목 생성으로
    if (hasWritingStyleExamples) {
      this.logger.log('📝 Proceeding to writing style rewrite node');
      return 'rewrite_writing_style';
    } else {
      this.logger.log('📝 Skipping writing style rewrite, proceeding to title generation');
      return 'generate_newsletter_title';
    }
  }

  /**
   * 뉴스레터 생성 메인 메소드
   */
  async generateNewsletter(input: NewsletterInput): Promise<NewsletterOutput> {
    try {
      this.logger.log('🚀 Starting newsletter generation workflow');
      this.logger.log(`📝 Topic: ${input.topic}`);
      this.logger.log(`💡 Key insight: ${input.keyInsight || 'None'}`);
      this.logger.log(`📊 Scraps count: ${input.scrapsWithComments?.length || 0}`);
      this.logger.log(`⚙️ Generation params: ${input.generationParams || 'None'}`);

      const result = await this.graph.invoke({
        topic: input.topic,
        keyInsight: input.keyInsight,
        scrapsWithComments: input.scrapsWithComments,
        generationParams: input.generationParams,
        articleStructureTemplate: input.articleStructureTemplate,
        processingSteps: [],
        warnings: [],
        errors: [],
        feedbacks: [],
        countOfReflector: 0,
        writingStyleExampleContents: input.writingStyleExampleContents,
      });

      if (result.errors?.length) {
        this.logger.error(`❌ Newsletter generation failed: ${result.errors.join(', ')}`);
        throw new Error(`Newsletter generation failed: ${result.errors.join(', ')}`);
      }

      const output: NewsletterOutput = {
        title: result.title,
        content: result.content,
        analysisReason: result.analysisReason || 'AI 시스템으로 생성된 뉴스레터입니다.',
        warnings: result.warnings || [],
      };

      this.logger.log('🎉 Newsletter generation completed successfully');

      return output;
    } catch (error) {
      this.logger.error('🚨 Newsletter generation workflow failed:', error);
      throw error;
    }
  }

  /**
   * 페이지 구조 분석 (독립적인 메소드)
   */
  async analyzePageStructure(content: string): Promise<any> {
    try {
      this.logger.log('🔍 Analyzing page structure');

      const template = this.promptTemplatesService.getStructureAnalysisTemplate();
      const chain = template
        .pipe(this.model)
        .pipe(new JsonOutputParser());

      const result = await chain.invoke({ content });
      
      this.logger.log('✅ Page structure analysis completed');
      return result;
    } catch (error) {
      this.logger.error('❌ Page structure analysis failed:', error);
      throw error;
    }
  }

  async rewriteWritingStyleNode(
    state: typeof NewsletterStateAnnotation.State,
  ): Promise<NodeResult> {
    const processingSteps = [
      ...(state.processingSteps || []),
      'writing_style_rewrite',
    ];

    try {
      // 문체 예시가 없으면 원본 내용 그대로 반환
      if (!state.writingStyleExampleContents || state.writingStyleExampleContents.length === 0) {
        this.logger.log('📝 No writing style examples provided, skipping rewrite');
        return {
          content: state.content,
          processingSteps,
          warnings: [
            ...(state.warnings || []),
            '문체 예시가 제공되지 않아 원본 내용을 유지합니다.',
          ],
        };
      }

      this.logger.log('📝 Rewriting content with writing style examples');

      const template = this.promptTemplatesService.getWritingStyleRewriteTemplate();
      const chain = template.pipe(this.rewriteModel).pipe(new StringOutputParser());

      const writingStyleExamples = state.writingStyleExampleContents.join('\n\n---\n\n');

      const result = await chain.invoke({
        topic: state.topic,
        keyInsight: state.keyInsight || '없음',
        content: state.content,
        writingStyleExamples,
      });

      return {
        content: result,
        processingSteps,
      };
    } catch (error) {
      this.logger.error('문체 재작성 오류:', error);
      return {
        content: state.content,
        processingSteps,
        warnings: [
          ...(state.warnings || []),
          '문체 재작성 중 오류가 발생하여 원본 내용을 유지합니다.',
        ],
        errors: [
          ...(state.errors || []),
          '문체 재작성 중 오류가 발생했습니다.',
        ],
      };
    }
  }
}