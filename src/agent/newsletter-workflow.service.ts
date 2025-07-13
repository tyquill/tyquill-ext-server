import { Injectable } from '@nestjs/common';
import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ScrapCombinationService, ScrapWithComment } from './scrap-combination.service';
import { NewsletterToolsService, ToolResult } from './newsletter-tools.service';
import { NewsletterPromptTemplatesService } from './newsletter-prompt-templates.service';
import { NewsletterAgentService } from './newsletter-agent.service';
import { 
  NewsletterQualityService, 
  QualityMetrics, 
  ReflectionResult} from './newsletter-quality.service';
import { ToolNodesService } from './node/tool-nodes.service';
import { AgentNodesService } from './node/agent-nodes.service';
import { QualityNodesService } from './node/quality-nodes.service';
import { ContentParser } from '../utils/content-parser.util';

/**
 * 뉴스레터 워크플로우 설정 인터페이스
 * 
 * @description 뉴스레터 생성 워크플로우의 동작을 제어하는 설정값들을 정의합니다.
 * 이 설정들을 통해 품질 관리, 재시도 로직, 라우팅 결정 등을 조정할 수 있습니다.
 */
interface WorkflowConfig {
  /**
   * 신뢰도 기반 라우팅을 위한 임계값 설정
   */
  confidenceThresholds: {
    /**
     * 높은 신뢰도 임계값 (0-100)
     * @description 이 값 이상의 신뢰도를 가진 콘텐츠는 즉시 승인되어 high_confidence 라우트로 진행
     * @default 70
     */
    high: number;
    
    /**
     * 중간 신뢰도 임계값 (0-100)
     * @description 이 값 이상의 신뢰도를 가진 콘텐츠는 medium_confidence 라우트로 진행
     * @default 40
     */
    medium: number;
  };
  
  /**
   * 재시도 및 교정 프로세스 제한 설정
   */
  retryLimits: {
    /**
     * 최대 자기교정 시도 횟수
     * @description 품질이 기준에 미달할 때 자기교정을 시도하는 최대 횟수
     * 무한 루프를 방지하고 성능을 보장하기 위한 제한
     * @default 2
     */
    maxSelfCorrectionAttempts: number;
  };
}

// 뉴스레터 유형 정의 (확장됨)
export enum NewsletterType {
  INFORMATIONAL = 'informational', // 정보전달형
  PROMOTIONAL = 'promotional', // 광고/프로모션형  
  ESSAY = 'essay', // 에세이/스토리텔링형
  CURATION = 'curation', // 큐레이션/요약형
  COMMUNITY = 'community', // 커뮤니티/참여형
  WELCOME = 'welcome', // 웰컴 이메일
  NURTURING = 'nurturing', // 너처링 이메일
}

// 확장된 뉴스레터 상태 정의 (도구 관련 필드 추가)
export const NewsletterStateAnnotation = Annotation.Root({
  // 입력 데이터
  topic: Annotation<string>,
  keyInsight: Annotation<string | undefined>,
  scrapsWithComments: Annotation<ScrapWithComment[]>,
  generationParams: Annotation<string | undefined>,
  
  // 분석 결과
  newsletterType: Annotation<NewsletterType | undefined>,
  analysisReason: Annotation<string | undefined>,
  confidenceScore: Annotation<number | undefined>, // 분류 신뢰도
  
  // 스크랩 분석 데이터
  scrapContent: Annotation<string>,
  
  // 중간 결과
  draftTitle: Annotation<string | undefined>,
  draftContent: Annotation<string | undefined>,
  
  // 품질 검증
  qualityMetrics: Annotation<QualityMetrics | undefined>,
  validationIssues: Annotation<string[]>,
  
  // 리플렉션 시스템 (새로 추가)
  reflectionResult: Annotation<ReflectionResult | undefined>,
  selfCorrectionAttempts: Annotation<number>,
  
  // 멀티 에이전트 결과 (새로 추가)
  writerOutput: Annotation<string | undefined>,
  editorOutput: Annotation<string | undefined>,
  reviewerOutput: Annotation<string | undefined>,
  strategistOutput: Annotation<string | undefined>,
  
  // 도구 사용 결과 (새로 추가)
  needsTools: Annotation<boolean | undefined>,
  recommendedTools: Annotation<string[]>,
  toolResults: Annotation<ToolResult[]>,
  webSearchResults: Annotation<string | undefined>,
  urlContentResults: Annotation<string | undefined>,
  keywordResults: Annotation<string[]>,
  factCheckResults: Annotation<string | undefined>,
  
  // 최종 결과
  title: Annotation<string | undefined>,
  content: Annotation<string | undefined>,
  
  // 추가 메타데이터
  processingSteps: Annotation<string[]>,
  warnings: Annotation<string[]>,
  suggestions: Annotation<string[]>,
  reasoning: Annotation<string[]>, // 추론 과정 기록 (새로 추가)
  
  // 에러 처리
  error: Annotation<string | undefined>,
});

export interface NewsletterInput {
  topic: string;
  keyInsight?: string;
  scrapsWithComments: ScrapWithComment[];
  generationParams?: string;
}

export interface NewsletterOutput {
  title: string;
  content: string;
  newsletterType: NewsletterType;
  analysisReason: string;
  qualityMetrics: QualityMetrics;
  warnings: string[];
  suggestions: string[];
  reflectionResult?: ReflectionResult;
  reasoning: string[];
  // 도구 관련 결과 (새로 추가)
  toolsUsed: string[];
  toolResults?: ToolResult[];
}

@Injectable()
export class NewsletterWorkflowService {
  private readonly model: ChatGoogleGenerativeAI;
  private readonly strategistModel: ChatGoogleGenerativeAI;
  private graph: any;

  /**
   * 워크플로우 설정값들 - 하드코딩된 값들을 여기서 중앙 관리
   * 
   * @description 뉴스레터 생성 워크플로우의 핵심 설정값들을 정의합니다.
   * 이 설정들을 통해 워크플로우의 동작을 조정할 수 있으며,
   * 향후 환경변수나 데이터베이스에서 로드하도록 확장 가능합니다.
   */
  private readonly config: WorkflowConfig = {
    confidenceThresholds: {
      high: 70,    // 높은 신뢰도 임계값 - 이 값 이상이면 즉시 승인
      medium: 40,  // 중간 신뢰도 임계값 - 이 값 이상이면 중간 품질로 분류
    },
    retryLimits: {
      maxSelfCorrectionAttempts: 2, // 최대 자기교정 시도 횟수 - 무한 루프 방지
    },
  };

  /**
   * 설정값 접근을 위한 getter 메서드들
   * 향후 외부에서 설정을 동적으로 변경할 수 있는 확장성 제공
   */
  
  /**
   * 현재 confidence threshold 설정 반환
   */
  public getConfidenceThresholds(): { high: number; medium: number } {
    return { ...this.config.confidenceThresholds };
  }

  /**
   * 현재 retry 제한 설정 반환
   */
  public getRetryLimits(): { maxSelfCorrectionAttempts: number } {
    return { ...this.config.retryLimits };
  }

  /**
   * 전체 설정 객체 반환 (읽기 전용)
   */
  public getWorkflowConfig(): Readonly<WorkflowConfig> {
    return {
      confidenceThresholds: { ...this.config.confidenceThresholds },
      retryLimits: { ...this.config.retryLimits },
    };
  }

  constructor(
    private readonly scrapCombinationService: ScrapCombinationService,
    private readonly toolsService: NewsletterToolsService,
    private readonly promptTemplatesService: NewsletterPromptTemplatesService,
    private readonly agentService: NewsletterAgentService,
    private readonly qualityService: NewsletterQualityService,
    // 새로운 노드 서비스들 주입
    private readonly toolNodesService: ToolNodesService,
    private readonly agentNodesService: AgentNodesService,
    private readonly qualityNodesService: QualityNodesService,
  ) {
    // 메인 모델 (일반적인 생성 작업용)
    this.model = new ChatGoogleGenerativeAI({
      model: 'gemini-2.0-flash',
      temperature: 0.7,
      apiKey: process.env.GOOGLE_API_KEY,
    });

    // 전략적 분석용 모델
    this.strategistModel = new ChatGoogleGenerativeAI({
      model: 'gemini-1.5-pro',
      temperature: 0.5,
      apiKey: process.env.GOOGLE_API_KEY,
    });

    this.initializeGraph();
  }

  /**
   * 그래프 초기화
   */
  private initializeGraph(): void {
    // StateGraph 생성 (도구 지원 고도화된 멀티 에이전트 노드들)
    const graphBuilder = new StateGraph(NewsletterStateAnnotation)
      // 기본 파이프라인 노드들
      .addNode('prepare_scrap_content', this.prepareScrapContentNode.bind(this))
      .addNode('strategic_analysis', this.strategicAnalysisNode.bind(this))
      .addNode('chain_of_thought', this.chainOfThoughtNode.bind(this))
      .addNode('classify_newsletter_type', this.classifyNewsletterTypeNode.bind(this))
      
      // 도구 활용 노드들 (새로 추가)
      .addNode('assess_tool_needs', this.assessToolNeedsNode.bind(this))
      .addNode('execute_tools', this.executeToolsNode.bind(this))
      .addNode('integrate_tool_results', this.integrateToolResultsNode.bind(this))
      
      // 멀티 에이전트 생성 노드들
      .addNode('multi_agent_generation', this.multiAgentGenerationNode.bind(this))
      
      // 종합 및 품질 관리 노드들
      .addNode('synthesize_outputs', this.synthesizeOutputsNode.bind(this))
      .addNode('validate_quality', this.validateQualityNode.bind(this))
      .addNode('reflection_analysis', this.reflectionAnalysisNode.bind(this))
      .addNode('self_correction', this.selfCorrectionNode.bind(this))
      .addNode('handle_error', this.handleErrorNode.bind(this))
      
      // 고도화된 도구 지원 에지 구조
      .addEdge(START, 'prepare_scrap_content')
      .addEdge('prepare_scrap_content', 'strategic_analysis')
      .addEdge('strategic_analysis', 'chain_of_thought')
      .addEdge('chain_of_thought', 'classify_newsletter_type')
      .addEdge('classify_newsletter_type', 'assess_tool_needs')
      
      // 도구 사용 필요성 평가 후 분기
      .addConditionalEdges(
        'assess_tool_needs',
        this.routeByToolNeeds.bind(this),
        {
          'use_tools': 'execute_tools',
          'skip_tools': 'multi_agent_generation',
          'error': 'handle_error',
        }
      )
      
      // 도구 실행 후 결과 통합
      .addEdge('execute_tools', 'integrate_tool_results')
      .addEdge('integrate_tool_results', 'multi_agent_generation')
      
      // 신뢰도 기반 멀티 에이전트 분기
      .addConditionalEdges(
        'multi_agent_generation',
        this.routeByClassificationConfidence.bind(this),
        {
          'high_confidence': 'synthesize_outputs',
          'medium_confidence': 'synthesize_outputs',
          'low_confidence': 'handle_error',
          'error': 'handle_error',
        }
      )
      
      // 품질 검증 및 리플렉션 체인
      .addEdge('synthesize_outputs', 'validate_quality')
      .addEdge('validate_quality', 'reflection_analysis')
      
      // 리플렉션 결과에 따른 분기 (무한 루프 방지)
      .addConditionalEdges(
        'reflection_analysis',
        this.routeByReflectionResult.bind(this),
        {
          'high_quality': END,
          'needs_improvement': 'self_correction',
          'error': 'handle_error',
        }
      )
      
      // 자기 교정 후 종료 (무한 루프 방지)
      .addEdge('self_correction', END)
      .addEdge('handle_error', END);

    // 그래프 컴파일
    this.graph = graphBuilder.compile();
  }

  /**
   * 스크랩 데이터 준비 노드 (향상된 에러 처리)
   */
  private async prepareScrapContentNode(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    const processingSteps = [...(state.processingSteps || []), 'scrap_content_preparation'];
    
    try {
      if (!state.scrapsWithComments || state.scrapsWithComments.length === 0) {
        return {
          processingSteps,
          warnings: [...(state.warnings || []), '스크랩 데이터가 제공되지 않았습니다.'],
          scrapContent: '스크랩 데이터 없음. 주제와 핵심 인사이트만으로 진행합니다.',
          toolResults: [],
        };
      }

      const scrapContent = await this.scrapCombinationService.formatForAiPromptWithComments(
        state.scrapsWithComments
      );
      
      return {
        scrapContent,
        processingSteps,
        toolResults: [],
      };
    } catch (error) {
      console.error('스크랩 데이터 준비 오류:', error);
      return {
        error: '스크랩 데이터를 준비하는 중 오류가 발생했습니다.',
        processingSteps,
        toolResults: [],
      };
    }
  }

  /**
   * 도구 사용 필요성 평가 노드 (ToolNodesService에 위임)
   */
  private async assessToolNeedsNode(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    return this.toolNodesService.assessToolNeeds(state);
  }

  /**
   * 도구 실행 노드 (ToolNodesService에 위임)
   */
  private async executeToolsNode(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    return this.toolNodesService.executeTools(state);
  }

  /**
   * 도구 결과 통합 노드 (ToolNodesService에 위임)
   */
  private async integrateToolResultsNode(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    return this.toolNodesService.integrateToolResults(state);
  }

  /**
   * 도구 필요성 기반 라우팅 함수 (새로 추가)
   */
  private routeByToolNeeds(state: typeof NewsletterStateAnnotation.State): string {
    if (state.error) {
      return 'error';
    }
    
    if (state.needsTools && state.recommendedTools && state.recommendedTools.length > 0) {
      return 'use_tools';
    } else {
      return 'skip_tools';
    }
  }

  /**
   * 전략적 분석 노드 (새로 추가)
   */
  private async strategicAnalysisNode(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    const processingSteps = [...(state.processingSteps || []), 'strategic_analysis'];
    const reasoning = [...(state.reasoning || [])];
    
    try {
      const template = this.promptTemplatesService.getStrategicAnalysisTemplate();
      const chain = template.pipe(this.strategistModel).pipe(new StringOutputParser());
      
      const result = await chain.invoke({
        topic: state.topic,
        keyInsight: state.keyInsight || '없음',
        generationParams: state.generationParams || '없음',
        newsletterType: 'unknown', // 아직 분류되지 않음
      });

      reasoning.push('전략적 분석 완료');

      return {
        strategistOutput: result,
        processingSteps,
        reasoning,
        suggestions: [...(state.suggestions || []), '전략적 분석 수행됨'],
      };
    } catch (error) {
      console.error('전략적 분석 오류:', error);
      return {
        error: '전략적 분석 중 오류가 발생했습니다.',
        processingSteps,
        reasoning,
      };
    }
  }

  /**
   * Chain of Thought 추론 노드 (새로 추가)
   */
  private async chainOfThoughtNode(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    const processingSteps = [...(state.processingSteps || []), 'chain_of_thought_reasoning'];
    const reasoning = [...(state.reasoning || [])];
    
    try {
      const template = this.promptTemplatesService.getChainOfThoughtTemplate();
      const chain = template.pipe(this.model).pipe(new StringOutputParser());
      
      const result = await chain.invoke({
        topic: state.topic,
        keyInsight: state.keyInsight || '없음',
        generationParams: state.generationParams || '없음',
        scrapContent: state.scrapContent,
      });

      reasoning.push('Chain of Thought 추론 완료');

      return {
        processingSteps,
        reasoning,
      };
    } catch (error) {
      console.error('Chain of Thought 추론 오류:', error);
      return {
        error: 'Chain of Thought 추론 중 오류가 발생했습니다.',
        processingSteps,
        reasoning,
      };
    }
  }

  /**
   * 멀티 에이전트 생성 노드 (AgentNodesService에 위임)
   */
  private async multiAgentGenerationNode(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    return this.agentNodesService.executeMultiAgentGeneration(state);
  }

  /**
   * 뉴스레터 유형 분류 노드 (리팩토링됨)
   */
  private async classifyNewsletterTypeNode(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    const processingSteps = [...(state.processingSteps || []), 'newsletter_type_classification'];
    
    try {
      const template = this.promptTemplatesService.getTypeClassificationTemplate();
      const chain = template.pipe(this.model).pipe(new StringOutputParser());
      
      const result = await chain.invoke({
        topic: state.topic,
        keyInsight: state.keyInsight || '없음',
        generationParams: state.generationParams || '없음',
        scrapContent: state.scrapContent,
      });

      const typeMatch = result.match(/TYPE:\s*(\w+)/i);
      const confidenceMatch = result.match(/CONFIDENCE:\s*(\d+)/i);
      const reasonMatch = result.match(/REASON:\s*(.+)/i);

      if (!typeMatch) {
        throw new Error('뉴스레터 유형을 분류할 수 없습니다.');
      }

      const newsletterType = typeMatch[1].toLowerCase() as NewsletterType;
      const confidenceScore = confidenceMatch ? parseInt(confidenceMatch[1]) : 0;
      const analysisReason = reasonMatch ? reasonMatch[1].trim() : '분석 이유를 확인할 수 없습니다.';

      // 유효한 뉴스레터 유형인지 확인
      if (!Object.values(NewsletterType).includes(newsletterType)) {
        throw new Error(`알 수 없는 뉴스레터 유형: ${newsletterType}`);
      }

      return {
        newsletterType,
        confidenceScore,
        analysisReason,
        processingSteps,
      };
    } catch (error) {
      console.error('뉴스레터 유형 분류 오류:', error);
      return {
        error: '뉴스레터 유형을 분류하는 중 오류가 발생했습니다.',
        processingSteps,
      };
    }
  }

  /**
   * 에이전트 결과 종합 노드 (AgentNodesService에 위임)
   */
  private async synthesizeOutputsNode(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    return this.agentNodesService.synthesizeAgentOutputs(state);
  }

  /**
   * 리플렉션 분석 노드 (QualityNodesService에 위임)
   */
  private async reflectionAnalysisNode(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    return this.qualityNodesService.performReflectionAnalysis(state);
  }

  /**
   * 자기 교정 노드 (QualityNodesService에 위임)
   */
  private async selfCorrectionNode(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    return this.qualityNodesService.performSelfCorrection(state);
  }

  /**
   * 향상된 신뢰도 기반 라우팅 함수
   */
  private routeByClassificationConfidence(state: typeof NewsletterStateAnnotation.State): string {
    if (state.error) {
      return 'error';
    }
    
    const confidence = state.confidenceScore || 0;
    if (confidence >= this.config.confidenceThresholds.high) {
      return 'high_confidence';
    } else if (confidence >= this.config.confidenceThresholds.medium) {
      return 'medium_confidence';
    } else {
      return 'low_confidence';
    }
  }

  /**
   * 리플렉션 결과 기반 라우팅 함수 (QualityNodesService에 위임)
   */
  private routeByReflectionResult(state: typeof NewsletterStateAnnotation.State): string {
    return this.qualityNodesService.routeByReflectionResult(state);
  }

  /**
   * 품질 검증 노드 (QualityNodesService에 위임)
   */
  private async validateQualityNode(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    return this.qualityNodesService.validateQuality(state);
  }

  /**
   * 에러 처리 노드 (향상된 에러 메시지)
   */
  private async handleErrorNode(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    const processingSteps = [...(state.processingSteps || []), 'error_handling'];
    
    // 신뢰도가 낮은 경우 기본 큐레이션형으로 폴백
    if (state.confidenceScore && state.confidenceScore < 50) {
      try {
        const template = this.promptTemplatesService.getCurationTemplate();
        const chain = template.pipe(this.model).pipe(new StringOutputParser());
        
        const result = await chain.invoke({
          topic: state.topic,
          keyInsight: state.keyInsight || '',
          generationParams: state.generationParams || '',
          scrapContent: state.scrapContent,
        });

        const { title, content } = this.parseGeneratedContent(result);
        
        return {
          title,
          content,
          newsletterType: NewsletterType.CURATION,
          analysisReason: '신뢰도가 낮아 큐레이션형으로 폴백했습니다.',
          processingSteps,
          warnings: [...(state.warnings || []), '분류 신뢰도가 낮아 기본 형식을 사용했습니다.'],
        };
      } catch (error) {
        console.error('폴백 생성 실패:', error);
      }
    }

    return {
      title: '오류 발생',
      content: `뉴스레터 생성 중 오류가 발생했습니다: ${state.error}\n\n처리 단계: ${processingSteps.join(' → ')}`,
      processingSteps,
    };
  }

  /**
   * 생성된 콘텐츠에서 제목과 본문 파싱 (ContentParser 유틸리티에 위임)
   */
  private parseGeneratedContent(content: string): { title: string; content: string } {
    return ContentParser.parseNewsletterContent(content);
  }

  /**
   * 고도화된 멀티 에이전트 뉴스레터 생성 메인 메소드
   */
  async generateNewsletter(input: NewsletterInput): Promise<NewsletterOutput> {
    try {
      console.log(`🚀 고도화된 멀티 에이전트 뉴스레터 생성 시작`);
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
        processingSteps: [],
        warnings: [],
        suggestions: [],
        validationIssues: [],
        reasoning: [],
        selfCorrectionAttempts: 0,
        // 도구 관련 필드 초기화
        needsTools: false,
        recommendedTools: [],
        toolResults: [],
        webSearchResults: undefined,
        urlContentResults: undefined,
        keywordResults: [],
        factCheckResults: undefined,
      });

      const processingTime = Date.now() - startTime;

      if (result.error) {
        console.error(`❌ 뉴스레터 생성 실패: ${result.error}`);
        throw new Error(result.error);
      }

      // 향상된 품질 메트릭 기본값
      const defaultQualityMetrics: QualityMetrics = {
        clarity: 5,
        engagement: 5,
        accuracy: 5,
        completeness: 5,
        creativity: 5,
        persuasiveness: 5,
        overall: 5,
        confidence: 50,
      };

      const output: NewsletterOutput = {
        title: result.title,
        content: result.content,
        newsletterType: result.newsletterType || NewsletterType.CURATION,
        analysisReason: result.analysisReason || '고도화된 멀티 에이전트 도구 시스템으로 분석했습니다.',
        qualityMetrics: result.qualityMetrics || defaultQualityMetrics,
        warnings: result.warnings || [],
        suggestions: result.suggestions || [],
        reflectionResult: result.reflectionResult,
        reasoning: result.reasoning || [],
        // 도구 관련 결과 추가
        toolsUsed: result.recommendedTools || [],
        toolResults: result.toolResults || [],
      };

      // 상세한 결과 로깅
      console.log(`\n🎉 뉴스레터 생성 완료!`);
      console.log(`⏱️ 처리 시간: ${processingTime}ms`);
      console.log(`📋 유형: ${output.newsletterType}`);
      console.log(`📊 품질 점수: ${output.qualityMetrics.overall}/10 (신뢰도: ${output.qualityMetrics.confidence}%)`);

      if (output.toolsUsed.length > 0) {
        console.log(`🔧 사용된 도구: ${output.toolsUsed.join(', ')}`);
      }

      const processingSteps = result.processingSteps || [];
      console.log(`🔄 처리 단계: ${processingSteps.join(' → ')}`);

      return output;
    } catch (error) {
      console.error('🚨 뉴스레터 생성 워크플로우 치명적 오류:', error);
      throw error;
    }
  }
} 