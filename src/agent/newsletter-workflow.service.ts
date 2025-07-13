import { Injectable } from '@nestjs/common';
import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ScrapCombinationService, ScrapWithComment } from './scrap-combination.service';
import { NewsletterToolsService, ToolResult } from './newsletter-tools.service';
import { NewsletterPromptTemplatesService } from './newsletter-prompt-templates.service';
import { NewsletterAgentService, AgentPersona, MultiAgentInput } from './newsletter-agent.service';
import { 
  NewsletterQualityService, 
  QualityMetrics, 
  ReflectionResult,
  QualityValidationInput,
  SelfCorrectionInput 
} from './newsletter-quality.service';

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
   * 도구 사용 필요성 평가 노드 (새로 추가)
   */
  private async assessToolNeedsNode(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    const processingSteps = [...(state.processingSteps || []), 'tool_needs_assessment'];
    const reasoning = [...(state.reasoning || [])];
    
    try {
      const assessmentTemplate = this.promptTemplatesService.getToolEnabledTemplate();
      const chain = assessmentTemplate.pipe(this.strategistModel).pipe(new StringOutputParser());
      
      const result = await chain.invoke({
        topic: state.topic,
        keyInsight: state.keyInsight || '없음',
        newsletterType: state.newsletterType || 'unknown',
        generationParams: state.generationParams || '없음',
      });

      // 결과 파싱 - 단순화된 로직
      const needsTools = result.toLowerCase().includes('도구') || result.toLowerCase().includes('tool');
      const recommendedTools = needsTools ? ['web_search', 'fact_check'] : [];

      reasoning.push(`도구 필요성 평가: ${needsTools ? 'YES' : 'NO'}`);
      if (recommendedTools.length > 0) {
        reasoning.push(`권장 도구: ${recommendedTools.join(', ')}`);
      }

      return {
        needsTools,
        recommendedTools,
        processingSteps,
        reasoning,
      };
    } catch (error) {
      console.error('도구 필요성 평가 오류:', error);
      return {
        error: '도구 필요성 평가 중 오류가 발생했습니다.',
        processingSteps,
        reasoning,
        needsTools: false,
        recommendedTools: [],
      };
    }
  }

  /**
   * 도구 실행 노드 (리팩토링됨)
   */
  private async executeToolsNode(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    const processingSteps = [...(state.processingSteps || []), 'tools_execution'];
    const reasoning = [...(state.reasoning || [])];
    
    try {
      const recommendedTools = state.recommendedTools || [];
      
      if (recommendedTools.length === 0) {
        reasoning.push('권장된 도구가 없어 도구 실행을 건너뜁니다.');
        return {
          processingSteps,
          reasoning,
          toolResults: [],
        };
      }

      reasoning.push(`${recommendedTools.length}개 도구 실행 시작`);

      // 도구별 입력 준비
      const toolRequests = recommendedTools.map((toolName: string) => {
        let input: string;
        
        switch (toolName) {
          case 'web_search':
          case 'analyze_trends':
          case 'competitor_analysis':
            input = state.topic;
            break;
          case 'fact_check':
            input = state.keyInsight || state.topic;
            break;
          case 'sentiment_analysis':
          case 'extract_keywords':
          case 'generate_image_description':
            input = state.scrapContent || state.topic;
            break;
          case 'extract_url_content':
            const urls = state.scrapsWithComments?.map(sc => sc.scrap.url).filter(url => url) || [];
            input = urls.length > 0 ? urls[0] : 'https://example.com';
            break;
          default:
            input = state.topic;
        }

        return { toolName, input };
      });

      // 도구 서비스를 통해 병렬 실행
      const toolResults = await this.toolsService.executeToolsParallel(toolRequests);

      const successfulTools = toolResults.filter(r => r.success).length;
      reasoning.push(`도구 실행 완료: ${successfulTools}/${toolResults.length} 성공`);

      // 각 도구별 결과를 상태에 저장
      const webSearchResult = toolResults.find(r => r.toolName === 'web_search');
      const urlContentResult = toolResults.find(r => r.toolName === 'extract_url_content');
      const keywordResult = toolResults.find(r => r.toolName === 'extract_keywords');
      const factCheckResult = toolResults.find(r => r.toolName === 'fact_check');

      return {
        toolResults,
        webSearchResults: webSearchResult?.output,
        urlContentResults: urlContentResult?.output,
        keywordResults: keywordResult?.output ? [keywordResult.output] : [],
        factCheckResults: factCheckResult?.output,
        processingSteps,
        reasoning,
      };
    } catch (error) {
      console.error('도구 실행 오류:', error);
      return {
        error: '도구 실행 중 오류가 발생했습니다.',
        processingSteps,
        reasoning,
        toolResults: [],
      };
    }
  }

  /**
   * 도구 결과 통합 노드 (새로 추가)
   */
  private async integrateToolResultsNode(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    const processingSteps = [...(state.processingSteps || []), 'tool_results_integration'];
    const reasoning = [...(state.reasoning || [])];
    
    try {
      const toolResults = state.toolResults || [];
      
      if (toolResults.length === 0) {
        reasoning.push('통합할 도구 결과가 없습니다.');
        return {
          processingSteps,
          reasoning,
        };
      }

      // 도구 결과를 스크랩 콘텐츠에 통합
      let enhancedScrapContent = state.scrapContent || '';
      
      enhancedScrapContent += '\n\n## 🔧 도구 분석 결과\n';
      
      toolResults.forEach((result, index) => {
        if (result.success) {
          enhancedScrapContent += `\n### ${index + 1}. ${result.toolName} 결과\n`;
          enhancedScrapContent += `${result.output}\n`;
        }
      });

      reasoning.push(`${toolResults.length}개 도구 결과를 스크랩 콘텐츠에 통합`);

      return {
        scrapContent: enhancedScrapContent,
        processingSteps,
        reasoning,
      };
    } catch (error) {
      console.error('도구 결과 통합 오류:', error);
      return {
        error: '도구 결과 통합 중 오류가 발생했습니다.',
        processingSteps,
        reasoning,
      };
    }
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
   * 멀티 에이전트 생성 노드 (리팩토링됨)
   */
  private async multiAgentGenerationNode(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    const processingSteps = [...(state.processingSteps || []), 'multi_agent_execution'];
    const reasoning = [...(state.reasoning || [])];
    
    try {
      console.log('🤖 멀티 에이전트 시스템 실행');
      
      const agentInput: MultiAgentInput = {
        topic: state.topic,
        keyInsight: state.keyInsight,
        newsletterType: state.newsletterType || 'curation',
        scrapContent: state.scrapContent,
        webSearchResults: state.webSearchResults,
        factCheckResults: state.factCheckResults,
        keywordResults: state.keywordResults,
      };

      // 모든 에이전트를 병렬로 실행
      const agentResults = await this.agentService.executeAllAgents(agentInput);
      
      reasoning.push('멀티 에이전트 시스템 활성화: 4개 전문가 에이전트 병렬 실행 완료');

      return {
        writerOutput: agentResults.find(r => r.agentType === AgentPersona.WRITER)?.output,
        editorOutput: agentResults.find(r => r.agentType === AgentPersona.EDITOR)?.output,
        reviewerOutput: agentResults.find(r => r.agentType === AgentPersona.REVIEWER)?.output,
        strategistOutput: agentResults.find(r => r.agentType === AgentPersona.STRATEGIST)?.output,
        processingSteps,
        reasoning,
        selfCorrectionAttempts: 0,
      };
    } catch (error) {
      console.error('멀티 에이전트 실행 오류:', error);
      return {
        error: '멀티 에이전트 실행 중 오류가 발생했습니다.',
        processingSteps,
        reasoning,
      };
    }
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
   * 멀티 에이전트 결과 종합 노드 (리팩토링됨)
   */
  private async synthesizeOutputsNode(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    const processingSteps = [...(state.processingSteps || []), 'multi_agent_synthesis'];
    const reasoning = [...(state.reasoning || [])];
    
    try {
      // 에이전트 결과 수집
      const agentResults = [
        { agentType: AgentPersona.WRITER, output: state.writerOutput || '', processingTime: 0, confidence: 85 },
        { agentType: AgentPersona.EDITOR, output: state.editorOutput || '', processingTime: 0, confidence: 90 },
        { agentType: AgentPersona.REVIEWER, output: state.reviewerOutput || '', processingTime: 0, confidence: 80 },
        { agentType: AgentPersona.STRATEGIST, output: state.strategistOutput || '', processingTime: 0, confidence: 88 },
      ];

      // 에이전트 서비스를 통해 결과 종합
      const synthesisResult = await this.agentService.synthesizeAgentResults(agentResults);
      
      reasoning.push('멀티 에이전트 결과 종합 완료');

      return {
        title: synthesisResult.title,
        content: synthesisResult.content,
        draftTitle: synthesisResult.title,
        draftContent: synthesisResult.content,
        processingSteps,
        reasoning,
      };
    } catch (error) {
      console.error('멀티 에이전트 종합 오류:', error);
      return {
        error: '멀티 에이전트 결과 종합 중 오류가 발생했습니다.',
        processingSteps,
        reasoning,
      };
    }
  }

  /**
   * 리플렉션 분석 노드 (리팩토링됨)
   */
  private async reflectionAnalysisNode(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    const processingSteps = [...(state.processingSteps || []), 'reflection_analysis'];
    const reasoning = [...(state.reasoning || [])];
    
    try {
      const qualityInput: QualityValidationInput = {
        title: state.title || '',
        content: state.content || '',
        newsletterType: state.newsletterType || 'curation',
        topic: state.topic,
      };

      // 품질 서비스를 통해 리플렉션 분석 실행
      const reflectionResult = await this.qualityService.performReflectionAnalysis(qualityInput);

      reasoning.push(`리플렉션 분석 완료: 신뢰도 ${reflectionResult.confidence}%, 수정 필요 ${reflectionResult.needsRevision ? 'YES' : 'NO'}`);

      return {
        reflectionResult,
        processingSteps,
        reasoning,
      };
    } catch (error) {
      console.error('리플렉션 분석 오류:', error);
      return {
        error: '리플렉션 분석 중 오류가 발생했습니다.',
        processingSteps,
        reasoning,
      };
    }
  }

  /**
   * 자기 교정 노드 (리팩토링됨)
   */
  private async selfCorrectionNode(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    const processingSteps = [...(state.processingSteps || []), 'self_correction'];
    const reasoning = [...(state.reasoning || [])];
    const attempts = (state.selfCorrectionAttempts || 0) + 1;
    
    // 최대 2번까지만 자기 교정 시도
    if (attempts > this.config.retryLimits.maxSelfCorrectionAttempts) {
      reasoning.push('자기 교정 시도 한계 도달, 현재 버전으로 완료');
      return {
        processingSteps,
        reasoning,
        selfCorrectionAttempts: attempts,
        warnings: [...(state.warnings || []), '자기 교정이 여러 번 시도되었습니다.'],
      };
    }
    
    try {
      const correctionInput: SelfCorrectionInput = {
        originalTitle: state.title || '',
        originalContent: state.content || '',
        weaknesses: state.reflectionResult?.weaknesses || [],
        improvements: state.reflectionResult?.improvements || [],
      };

      // 품질 서비스를 통해 자기 교정 실행
      const correctionResult = await this.qualityService.performSelfCorrection(correctionInput);
      
      reasoning.push(`자기 교정 완료 (${attempts}번째 시도)`);

      return {
        title: correctionResult.correctedTitle,
        content: correctionResult.correctedContent,
        selfCorrectionAttempts: attempts,
        processingSteps,
        reasoning,
      };
    } catch (error) {
      console.error('자기 교정 오류:', error);
      return {
        error: '자기 교정 중 오류가 발생했습니다.',
        processingSteps,
        reasoning,
        selfCorrectionAttempts: attempts,
      };
    }
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
   * 리플렉션 결과 기반 라우팅 함수 (리팩토링됨)
   */
  private routeByReflectionResult(state: typeof NewsletterStateAnnotation.State): string {
    if (state.error) {
      return 'error';
    }
    
    const reflection = state.reflectionResult;
    const qualityMetrics = state.qualityMetrics;
    if (!reflection || !qualityMetrics) {
      return 'error';
    }

    // 재시도 횟수 확인 (최대 2회)
    const attempts = state.selfCorrectionAttempts || 0;
    if (attempts >= this.config.retryLimits.maxSelfCorrectionAttempts) {
      console.log('🔄 최대 재시도 횟수에 도달했습니다. 현재 결과로 종료합니다.');
      return 'high_quality';
    }

    // 품질 서비스의 판단 로직 사용
    const needsRevision = this.qualityService.needsRevisionByReflection(reflection, qualityMetrics, attempts);
    
    if (needsRevision) {
      return 'needs_improvement';
    } else {
      return 'high_quality';
    }
  }

  /**
   * 품질 검증 노드 (리팩토링됨)
   */
  private async validateQualityNode(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    const processingSteps = [...(state.processingSteps || []), 'quality_validation'];
    const reasoning = [...(state.reasoning || [])];
    
    try {
      const qualityInput: QualityValidationInput = {
        title: state.title || '',
        content: state.content || '',
        newsletterType: state.newsletterType || 'curation',
        topic: state.topic,
      };

      // 품질 서비스를 통해 종합 품질 검사 실행
      const qualityResult = await this.qualityService.performComprehensiveQualityCheck(qualityInput);

      reasoning.push(`품질 검증 완료: 전체 ${qualityResult.qualityMetrics.overall}/10, 신뢰도 ${qualityResult.qualityMetrics.confidence}%`);

      return {
        qualityMetrics: qualityResult.qualityMetrics,
        validationIssues: qualityResult.validationIssues,
        suggestions: [...(state.suggestions || []), ...qualityResult.suggestions],
        processingSteps,
        reasoning,
      };
    } catch (error) {
      console.error('품질 검증 오류:', error);
      return {
        error: '품질 검증 중 오류가 발생했습니다.',
        processingSteps,
        reasoning,
      };
    }
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
   * 생성된 콘텐츠 파싱 (향상된 파싱)
   */
  private parseGeneratedContent(content: string): { title: string; content: string } {
    // 1. 기존 형식 우선 시도
    const titleMatch = content.match(/TITLE:\s*(.+)/);
    const contentMatch = content.match(/CONTENT:\s*([\s\S]+)/);

    if (titleMatch && contentMatch) {
      return {
        title: titleMatch[1].trim(),
        content: contentMatch[1].trim(),
      };
    }

    // 2. 멀티 에이전트 형식 파싱
    const solutionMatch = content.match(/INTEGRATED_SOLUTION:\s*([\s\S]+)/i);
    let targetContent = solutionMatch ? solutionMatch[1].trim() : content;

    // **제목** 형식의 제목 찾기
    const boldTitleMatch = targetContent.match(/\*\*([^*]+)\*\*/);
    if (boldTitleMatch) {
      const title = boldTitleMatch[1].trim();
      const contentWithoutTitle = targetContent.replace(/\*\*[^*]+\*\*/, '').trim();
      return {
        title,
        content: contentWithoutTitle || targetContent,
      };
    }

    // 3. # 제목 형식 찾기
    const hashTitleMatch = targetContent.match(/^#\s*(.+)/m);
    if (hashTitleMatch) {
      const title = hashTitleMatch[1].trim();
      const contentWithoutTitle = targetContent.replace(/^#\s*.+/m, '').trim();
      return {
        title,
        content: contentWithoutTitle || targetContent,
      };
    }

    // 4. 첫 번째 줄을 제목으로 사용 (최후 수단)
    const lines = targetContent.split('\n');
    const firstLine = lines[0]?.trim();
    
    if (firstLine && firstLine.length > 0 && firstLine.length < 100) {
      const restContent = lines.slice(1).join('\n').trim();
      return {
        title: firstLine.replace(/[#*]/g, '').trim(),
        content: restContent || targetContent,
      };
    }

    // 5. 기본값 반환
    return {
      title: '생성된 뉴스레터',
      content: targetContent,
    };
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