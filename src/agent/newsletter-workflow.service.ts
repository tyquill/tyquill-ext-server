import { Injectable, Logger } from '@nestjs/common';
import { StateGraph, START, END } from '@langchain/langgraph';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { writeFileSync } from 'fs';
import {
  ScrapCombinationService,
} from './scrap-combination.service';
import { NewsletterPromptTemplatesService } from './newsletter-prompt-templates.service';
import {
  AI_MODELS_CONFIG,
  createModelInitConfig,
  APIKeyValidationError,
} from './config/ai-models.config';
import {
  NewsletterStateAnnotation,
  NewsletterInput,
  NewsletterOutput,
  NodeResult,
} from './types';
import {
  PrepareScrapContentNode,
  GenerateNewsletterNode,
  GenerateNewsletterTitleNode,
  ArticleReflectorNode,
  RewriteWritingStyleNode,
} from './nodes';

/**
 * 뉴스레터 워크플로우 서비스
 * LangGraph를 사용하여 AI 기반 뉴스레터 생성 워크플로우 관리
 */
@Injectable()
export class NewsletterWorkflowService {
  private readonly logger = new Logger(NewsletterWorkflowService.name);
  private graph: any;
  
  // AI 모델들
  private model!: ChatGoogleGenerativeAI;
  private titleModel!: ChatGoogleGenerativeAI;
  private reflectorModel!: ChatGoogleGenerativeAI;
  private rewriteModel!: ChatGoogleGenerativeAI;
  
  // 워크플로우 노드들
  private prepareScrapContentNode!: PrepareScrapContentNode;
  private generateNewsletterNode!: GenerateNewsletterNode;
  private generateNewsletterTitleNode!: GenerateNewsletterTitleNode;
  private articleReflectorNode!: ArticleReflectorNode;
  private rewriteWritingStyleNode!: RewriteWritingStyleNode;

  constructor(
    private readonly scrapCombinationService: ScrapCombinationService,
    private readonly promptTemplatesService: NewsletterPromptTemplatesService,
  ) {
    this.initializeModels();
    this.initializeNodes();
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

      // 제목 생성 전용 모델
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
   * 워크플로우 노드 초기화
   */
  private initializeNodes(): void {
    this.logger.log('📦 Initializing workflow nodes...');
    
    this.prepareScrapContentNode = new PrepareScrapContentNode(
      this.scrapCombinationService,
    );
    
    this.generateNewsletterNode = new GenerateNewsletterNode(
      this.model,
      this.promptTemplatesService,
    );
    
    this.generateNewsletterTitleNode = new GenerateNewsletterTitleNode(
      this.titleModel,
      this.promptTemplatesService,
    );
    
    this.articleReflectorNode = new ArticleReflectorNode(
      this.reflectorModel,
      this.promptTemplatesService,
    );
    
    this.rewriteWritingStyleNode = new RewriteWritingStyleNode(
      this.rewriteModel,
      this.promptTemplatesService,
    );
    
    this.logger.log('✅ Workflow nodes initialized successfully');
  }

  /**
   * LangGraph 워크플로우 초기화
   */
  private async initializeGraph(): Promise<any> {
    try {
      this.logger.log('🔄 Initializing newsletter workflow graph...');

      const graphBuilder = new StateGraph(NewsletterStateAnnotation)
        // 노드 등록
        .addNode('prepare_scrap_content', (state) => 
          this.prepareScrapContentNode.execute(state))
        .addNode('generate_newsletter', (state) => 
          this.generateNewsletterNode.execute(state))
        .addNode('generate_newsletter_title', (state) => 
          this.generateNewsletterTitleNode.execute(state))
        .addNode('article_reflector', (state) => 
          this.articleReflectorNode.execute(state))
        .addNode('rewrite_writing_style', (state) => 
          this.rewriteWritingStyleNode.execute(state))
        
        // 워크플로우 엣지 정의
        .addEdge(START, 'prepare_scrap_content')
        .addEdge('prepare_scrap_content', 'generate_newsletter')
        .addEdge('article_reflector', 'generate_newsletter')
        .addConditionalEdges('generate_newsletter', this.conditionalEdges.bind(this))
        .addEdge('rewrite_writing_style', 'generate_newsletter_title')
        .addEdge('generate_newsletter_title', END);

      this.graph = graphBuilder.compile();
      this.logger.log('✅ Newsletter workflow graph compiled successfully');

      // 그래프 시각화는 선택적으로 실행
      await this.generateGraphVisualization();
    } catch (error) {
      this.logger.error('❌ Failed to initialize workflow graph:', error);
      throw error;
    }
  }

  /**
   * 조건부 엣지 처리
   * 리플렉터 실행 여부 결정
   */
  private conditionalEdges(state: typeof NewsletterStateAnnotation.State): string {
    const countOfReflector = state.countOfReflector || 0;
    
    // 리플렉터를 2회까지만 실행
    if (countOfReflector < 2) {
      this.logger.log(`🔄 Running reflector (iteration ${countOfReflector + 1}/2)`);
      return 'article_reflector';
    }
    
    // 글쓰기 스타일이 있으면 재작성
    if (state.writingStyleExampleContents?.length) {
      this.logger.log('✍️ Applying writing style');
      return 'rewrite_writing_style';
    }
    
    // 바로 제목 생성으로
    return 'generate_newsletter_title';
  }

  /**
   * 워크플로우 그래프 시각화 생성
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
      this.logger.warn('📝 Newsletter workflow will continue to function normally');
    }
  }

  /**
   * 페이지 구조 분석
   */
  async analyzePageStructure(content: string): Promise<any> {
    this.logger.log('📊 Analyzing page structure');
    
    try {
      const template = this.promptTemplatesService.getStructureAnalysisTemplate();
      const chain = template.pipe(this.model).pipe(new JsonOutputParser());
      
      const result = await chain.invoke({ content });
      
      this.logger.log('✅ Page structure analysis completed');
      return result;
    } catch (error) {
      this.logger.error('❌ Page structure analysis failed:', error);
      throw new Error(`페이지 구조 분석 실패: ${error}`);
    }
  }

  /**
   * 뉴스레터 생성 실행
   */
  async generateNewsletter(input: NewsletterInput): Promise<NewsletterOutput> {
    this.logger.log('🚀 Starting newsletter generation workflow');
    this.logger.log(`📌 Topic: ${input.topic}`);
    this.logger.log(`📄 Scraps: ${input.scrapsWithComments?.length || 0}`);

    try {
      // 초기 상태 설정
      const initialState = {
        topic: input.topic,
        keyInsight: input.keyInsight,
        scrapsWithComments: input.scrapsWithComments || [],
        generationParams: input.generationParams,
        articleStructureTemplate: input.articleStructureTemplate,
        writingStyleExampleContents: input.writingStyleExampleContents,
        scrapContent: '',
        countOfReflector: 0,
        feedbacks: [],
        title: '',
        content: '',
        processingSteps: [],
        warnings: [],
        errors: [],
      };

      // 워크플로우 실행
      const result = await this.graph.invoke(initialState);

      this.logger.log('✅ Newsletter generation workflow completed successfully');

      return {
        title: result.title || '제목 없음',
        content: result.content || '내용 없음',
        analysisReason: '워크플로우를 통해 생성된 뉴스레터입니다.',
        warnings: result.warnings || [],
      };
    } catch (error) {
      this.logger.error('❌ Newsletter generation workflow failed:', error);
      throw new Error(`뉴스레터 생성 실패: ${error}`);
    }
  }
}