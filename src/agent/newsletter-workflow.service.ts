import { Injectable } from '@nestjs/common';
import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { JsonOutputParser, StringOutputParser } from '@langchain/core/output_parsers';
import {
  ScrapCombinationService,
  ScrapWithComment,
} from './scrap-combination.service';
import { NewsletterPromptTemplatesService } from './newsletter-prompt-templates.service';
import {
  AI_MODELS_CONFIG,
  createModelInitConfig,
  APIKeyValidationError,
} from '../config/ai-models.config';
import { SectionTemplate } from 'src/types/section-template';


export const NewsletterStateAnnotation = Annotation.Root({
  topic: Annotation<string>,
  keyInsight: Annotation<string | undefined>,
  scrapsWithComments: Annotation<ScrapWithComment[]>,
  generationParams: Annotation<string | undefined>,
  articleStructureTemplate: Annotation<string | undefined>,
  // 스크랩 분석 데이터
  scrapContent: Annotation<string>,

  // 최종 결과
  title: Annotation<string | undefined>,
  content: Annotation<string | undefined>,

  // 추가 메타데이터
  processingSteps: Annotation<string[]>,
  warnings: Annotation<string[]>,
});

export interface NewsletterInput {
  topic: string;
  keyInsight?: string;
  scrapsWithComments: ScrapWithComment[];
  generationParams?: string;
  articleStructureTemplate?: SectionTemplate[];
}

export interface NewsletterOutput {
  title: string;
  content: string;
  analysisReason: string;
  warnings: string[];
}

@Injectable()
export class NewsletterWorkflowService {
  private readonly model: ChatGoogleGenerativeAI;
  private graph: any;

  constructor(
    private readonly scrapCombinationService: ScrapCombinationService,
    private readonly promptTemplatesService: NewsletterPromptTemplatesService,
  ) {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log(
          '🤖 Initializing NewsletterWorkflowService with AI models...',
        );
      }

      // 메인 모델 (일반적인 생성 작업용) - 설정 파일에서 로드
      this.model = new ChatGoogleGenerativeAI(
        createModelInitConfig(AI_MODELS_CONFIG.workflow.main),
      );

      this.initializeGraph();

      console.log(
        '✅ NewsletterWorkflowService: Workflow models initialized successfully',
      );
    } catch (error) {
      if (error instanceof APIKeyValidationError) {
        console.error(
          '❌ NewsletterWorkflowService initialization failed:',
          error.message,
        );
        throw new Error(
          `Failed to initialize workflow models: ${error.message}`,
        );
      }
      console.error(
        '❌ Unexpected error during NewsletterWorkflowService initialization:',
        error,
      );
      throw error;
    }
  }

  /**
   * 그래프 초기화
   */
  private initializeGraph(): void {
    // StateGraph 생성 (매우 단순화된 뉴스레터 생성 워크플로우)
    const graphBuilder = new StateGraph(NewsletterStateAnnotation)
      .addNode('prepare_scrap_content', this.prepareScrapContentNode.bind(this))
      .addNode('generate_newsletter', this.generateNewsletterNode.bind(this))
      .addNode('generate_newsletter_title', this.generateNewsletterTitleNode.bind(this))

      // 간단한 선형 구조
      .addEdge(START, 'prepare_scrap_content')
      .addEdge('prepare_scrap_content', 'generate_newsletter')
      .addEdge('generate_newsletter', 'generate_newsletter_title')
      .addEdge('generate_newsletter_title', END);

    // 그래프 컴파일
    this.graph = graphBuilder.compile();
  }

  /**
   * 스크랩 데이터 준비 노드 (향상된 에러 처리)
   */
  private async prepareScrapContentNode(
    state: typeof NewsletterStateAnnotation.State,
  ): Promise<any> {
    const processingSteps = [
      ...(state.processingSteps || []),
      'scrap_content_preparation',
    ];

    try {
      if (!state.scrapsWithComments || state.scrapsWithComments.length === 0) {
        return {
          processingSteps,
          warnings: [
            ...(state.warnings || []),
            '스크랩 데이터가 제공되지 않았습니다.',
          ],
          scrapContent:
            '스크랩 데이터 없음. 주제와 핵심 인사이트만으로 진행합니다.',
        };
      }

      const scrapContent =
        await this.scrapCombinationService.formatForAiPromptWithComments(
          state.scrapsWithComments,
        );

      return {
        scrapContent,
        processingSteps,
      };
    } catch (error) {
      console.error('스크랩 데이터 준비 오류:', error);
      return {
        error: '스크랩 데이터를 준비하는 중 오류가 발생했습니다.',
        processingSteps,
      };
    }
  }

  /**
   * 뉴스레터 생성 노드 (단일 AI 모델로 간소화)
   */
  private async generateNewsletterNode(
    state: typeof NewsletterStateAnnotation.State,
  ): Promise<any> {
    const processingSteps = [
      ...(state.processingSteps || []),
      'newsletter_generation',
    ];

    try {
      console.log('📝 단일 AI 모델로 뉴스레터 생성');

      const template =
        this.promptTemplatesService.getSimpleNewsletterTemplate();
      const chain = template.pipe(this.model).pipe(new StringOutputParser());

      const result = await chain.invoke({
        topic: state.topic,
        keyInsight: state.keyInsight || '없음',
        generationParams: state.generationParams || '없음',
        scrapContent: state.scrapContent,
        articleStructureTemplate: state.articleStructureTemplate,
      });

      console.log('🔍 result:', result);


      return {
        content: result,
        analysisReason: '단일 AI 모델로 생성된 뉴스레터입니다.',
        processingSteps,
      };
    } catch (error) {
      console.error('뉴스레터 생성 오류:', error);
      return {
        error: '뉴스레터 생성 중 오류가 발생했습니다.',
        processingSteps,
      };
    }
  }

  private async generateNewsletterTitleNode(
    state: typeof NewsletterStateAnnotation.State,
  ): Promise<any> {
    try {
      console.log('📝 단일 AI 모델로 뉴스레터 제목 생성');
      const template =
        this.promptTemplatesService.getSimpleNewsletterTitleTemplate();
      const chain = template.pipe(this.model).pipe(new StringOutputParser());

      const result = await chain.invoke({
        topic: state.topic,
        keyInsight: state.keyInsight || '없음',
        generationParams: state.generationParams || '없음',
        content: state.content,
      });

      return {
        title: result.trim(),
      }
    } catch (error) {
      console.error('뉴스레터 제목 생성 오류:', error);
      return `${state.topic} 뉴스레터`; // 기본 제목
    }
  }

  /**
   * 고도화된 멀티 에이전트 뉴스레터 생성 메인 메소드
   */
  async generateNewsletter(input: NewsletterInput): Promise<NewsletterOutput> {
    try {
      console.log(`🚀 단순화된 뉴스레터 생성 시작`);
      console.log(`📝 주제: ${input.topic}`);
      console.log(`💡 핵심 인사이트: ${input.keyInsight || '없음'}`);
      console.log(`📊 스크랩 개수: ${input.scrapsWithComments?.length || 0}개`);
      console.log(`⚙️ 생성 파라미터: ${input.generationParams || '없음'}`);

      const startTime = Date.now();

      const result = await this.graph.invoke({
        topic: input.topic,
        keyInsight: input.keyInsight,
        scrapsWithComments: input.scrapsWithComments,
        generationParams: input.generationParams,
        articleStructureTemplate: input.articleStructureTemplate,
        processingSteps: [],
        warnings: [],
        suggestions: [],
        validationIssues: [],
      });

      const processingTime = Date.now() - startTime;

      if (result.error) {
        console.error(`❌ 뉴스레터 생성 실패: ${result.error}`);
        throw new Error(result.error);
      }

      const output: NewsletterOutput = {
        title: result.title,
        content: result.content,
        analysisReason:
          result.analysisReason || '단순화된 AI 시스템으로 생성했습니다.',
        warnings: result.warnings || [],
      };

      // 상세한 결과 로깅
      console.log(`\n🎉 뉴스레터 생성 완료!`);
      console.log(`⏱️ 처리 시간: ${processingTime}ms`);

      const processingSteps = result.processingSteps || [];
      console.log(`🔄 처리 단계: ${processingSteps.join(' → ')}`);

      return output;
    } catch (error) {
      console.error('🚨 뉴스레터 생성 워크플로우 치명적 오류:', error);
      throw error;
    }
  }

  async analyzePageStructure(content: string): Promise<any> {
    const template = this.promptTemplatesService.getStructureAnalysisTemplate();
    const chain = template.pipe(new ChatGoogleGenerativeAI(
      {
        model: 'gemini-2.5-flash',
        apiKey: process.env.GOOGLE_API_KEY,
      }
    )).pipe(new JsonOutputParser());
    // console.log('🔍 content:', content);
    const result = await chain.invoke({ content: content });
    // console.log('🔍 result:', result);
    return result;
  }
}
