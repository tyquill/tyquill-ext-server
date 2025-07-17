import { Injectable } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { 
  AI_MODELS_CONFIG, 
  createModelInitConfig, 
  APIKeyValidationError,
  logConfigurationInfo 
} from '../config/ai-models.config';
import { ContentParser, ParsedContent } from '../utils/content-parser.util';

// 멀티 에이전트 페르소나 정의
export enum AgentPersona {
  WRITER = 'writer', // 작성자 에이전트
  EDITOR = 'editor', // 편집자 에이전트
  REVIEWER = 'reviewer', // 검토자 에이전트
  STRATEGIST = 'strategist', // 전략가 에이전트
}

export interface AgentExecutionResult {
  agentType: AgentPersona;
  output: string;
  processingTime: number;
  confidence: number;
}

export interface MultiAgentInput {
  topic: string;
  keyInsight?: string;
  newsletterType: string;
  scrapContent: string;
  webSearchResults?: string;
  factCheckResults?: string;
  keywordResults?: string[];
}

export interface MultiAgentSynthesisResult {
  title: string;
  content: string;
  consensusElements: string[];
  resolvedConflicts: string[];
  synthesisConfidence: number;
}

@Injectable()
export class NewsletterAgentService {
  private readonly writerModel: ChatGoogleGenerativeAI;
  private readonly editorModel: ChatGoogleGenerativeAI;
  private readonly reviewerModel: ChatGoogleGenerativeAI;
  private readonly strategistModel: ChatGoogleGenerativeAI;
  private readonly synthesisModel: ChatGoogleGenerativeAI;

  // 에이전트별 프롬프트 템플릿들
  private writerPrompt: PromptTemplate;
  private editorPrompt: PromptTemplate;
  private reviewerPrompt: PromptTemplate;
  private strategistPrompt: PromptTemplate;
  private synthesisPrompt: PromptTemplate;

  constructor() {
    try {
      // 개발 환경에서 설정 정보 출력 (중복 방지를 위해 한 번만)
      if (process.env.NODE_ENV === 'development') {
        console.log('🤖 Initializing NewsletterAgentService with AI models...');
      }

      // 각 에이전트별로 특화된 모델 설정 (설정 파일에서 로드)
      this.writerModel = new ChatGoogleGenerativeAI(
        createModelInitConfig(AI_MODELS_CONFIG.agents.writer)
      );

      this.editorModel = new ChatGoogleGenerativeAI(
        createModelInitConfig(AI_MODELS_CONFIG.agents.editor)
      );

      this.reviewerModel = new ChatGoogleGenerativeAI(
        createModelInitConfig(AI_MODELS_CONFIG.agents.reviewer)
      );

      this.strategistModel = new ChatGoogleGenerativeAI(
        createModelInitConfig(AI_MODELS_CONFIG.agents.strategist)
      );

      this.synthesisModel = new ChatGoogleGenerativeAI(
        createModelInitConfig(AI_MODELS_CONFIG.agents.synthesis)
      );

      this.initializeAgentPrompts();
      
      console.log('✅ NewsletterAgentService: All agent models initialized successfully');
    } catch (error) {
      if (error instanceof APIKeyValidationError) {
        console.error('❌ NewsletterAgentService initialization failed:', error.message);
        throw new Error(`Failed to initialize agent models: ${error.message}`);
      }
      console.error('❌ Unexpected error during NewsletterAgentService initialization:', error);
      throw error;
    }
  }

  /**
   * 모든 에이전트를 병렬로 실행
   */
  async executeAllAgents(input: MultiAgentInput): Promise<AgentExecutionResult[]> {
    const startTime = Date.now();
    
    console.log('🤖 멀티 에이전트 병렬 실행 시작');

    const agentPromises = [
      this.executeWriterAgent(input),
      this.executeEditorAgent(input),
      this.executeReviewerAgent(input),
      this.executeStrategistAgent(input),
    ];

    const results = await Promise.all(agentPromises);
    
    const processingTime = Date.now() - startTime;
    console.log(`⚡ 모든 에이전트 실행 완료 (${processingTime}ms)`);

    return results;
  }

  /**
   * 작성자 에이전트 실행
   */
  async executeWriterAgent(input: MultiAgentInput): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    
    try {
      const chain = this.writerPrompt.pipe(this.writerModel).pipe(new StringOutputParser());
      
      const result = await chain.invoke({
        topic: input.topic,
        keyInsight: input.keyInsight || '',
        newsletterType: input.newsletterType,
        scrapContent: input.scrapContent,
        webSearchResults: input.webSearchResults || '웹 검색 결과 없음',
        factCheckResults: input.factCheckResults || '팩트체크 결과 없음',
        keywordResults: (input.keywordResults || []).join(', ') || '키워드 분석 결과 없음',
      });

      const processingTime = Date.now() - startTime;
      console.log(`✍️ 작성자 에이전트 완료 (${processingTime}ms)`);

      return {
        agentType: AgentPersona.WRITER,
        output: result,
        processingTime,
        confidence: this.extractConfidenceFromOutput(result, 85), // 기본 85%
      };
    } catch (error) {
      console.error('작성자 에이전트 오류:', error);
      return {
        agentType: AgentPersona.WRITER,
        output: `작성자 에이전트 실행 중 오류가 발생했습니다: ${error.message}`,
        processingTime: Date.now() - startTime,
        confidence: 0,
      };
    }
  }

  /**
   * 편집자 에이전트 실행
   */
  async executeEditorAgent(input: MultiAgentInput): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    
    try {
      const chain = this.editorPrompt.pipe(this.editorModel).pipe(new StringOutputParser());
      
      const result = await chain.invoke({
        topic: input.topic,
        keyInsight: input.keyInsight || '',
        newsletterType: input.newsletterType,
        scrapContent: input.scrapContent,
      });

      const processingTime = Date.now() - startTime;
      console.log(`📝 편집자 에이전트 완료 (${processingTime}ms)`);

      return {
        agentType: AgentPersona.EDITOR,
        output: result,
        processingTime,
        confidence: this.extractConfidenceFromOutput(result, 90), // 편집자는 보통 높은 신뢰도
      };
    } catch (error) {
      console.error('편집자 에이전트 오류:', error);
      return {
        agentType: AgentPersona.EDITOR,
        output: `편집자 에이전트 실행 중 오류가 발생했습니다: ${error.message}`,
        processingTime: Date.now() - startTime,
        confidence: 0,
      };
    }
  }

  /**
   * 검토자 에이전트 실행
   */
  async executeReviewerAgent(input: MultiAgentInput): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    
    try {
      const chain = this.reviewerPrompt.pipe(this.reviewerModel).pipe(new StringOutputParser());
      
      const result = await chain.invoke({
        topic: input.topic,
        keyInsight: input.keyInsight || '',
        newsletterType: input.newsletterType,
        scrapContent: input.scrapContent,
      });

      const processingTime = Date.now() - startTime;
      console.log(`🔍 검토자 에이전트 완료 (${processingTime}ms)`);

      return {
        agentType: AgentPersona.REVIEWER,
        output: result,
        processingTime,
        confidence: this.extractConfidenceFromOutput(result, 80), // 비판적이므로 조금 낮은 신뢰도
      };
    } catch (error) {
      console.error('검토자 에이전트 오류:', error);
      return {
        agentType: AgentPersona.REVIEWER,
        output: `검토자 에이전트 실행 중 오류가 발생했습니다: ${error.message}`,
        processingTime: Date.now() - startTime,
        confidence: 0,
      };
    }
  }

  /**
   * 전략가 에이전트 실행
   */
  async executeStrategistAgent(input: MultiAgentInput): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    
    try {
      const chain = this.strategistPrompt.pipe(this.strategistModel).pipe(new StringOutputParser());
      
      const result = await chain.invoke({
        topic: input.topic,
        keyInsight: input.keyInsight || '',
        newsletterType: input.newsletterType,
        scrapContent: input.scrapContent,
      });

      const processingTime = Date.now() - startTime;
      console.log(`🎯 전략가 에이전트 완료 (${processingTime}ms)`);

      return {
        agentType: AgentPersona.STRATEGIST,
        output: result,
        processingTime,
        confidence: this.extractConfidenceFromOutput(result, 88), // 전략적 판단력 신뢰도
      };
    } catch (error) {
      console.error('전략가 에이전트 오류:', error);
      return {
        agentType: AgentPersona.STRATEGIST,
        output: `전략가 에이전트 실행 중 오류가 발생했습니다: ${error.message}`,
        processingTime: Date.now() - startTime,
        confidence: 0,
      };
    }
  }

  /**
   * 멀티 에이전트 결과 종합
   */
  async synthesizeAgentResults(agentResults: AgentExecutionResult[]): Promise<MultiAgentSynthesisResult> {
    const startTime = Date.now();
    
    try {
      const writerOutput = agentResults.find(r => r.agentType === AgentPersona.WRITER)?.output || '작성자 결과 없음';
      const editorOutput = agentResults.find(r => r.agentType === AgentPersona.EDITOR)?.output || '편집자 결과 없음';
      const reviewerOutput = agentResults.find(r => r.agentType === AgentPersona.REVIEWER)?.output || '검토자 결과 없음';
      const strategistOutput = agentResults.find(r => r.agentType === AgentPersona.STRATEGIST)?.output || '전략가 결과 없음';

      const chain = this.synthesisPrompt.pipe(this.synthesisModel).pipe(new StringOutputParser());
      
      const result = await chain.invoke({
        writerOutput,
        editorOutput,
        reviewerOutput,
        strategistOutput,
      });

      const processingTime = Date.now() - startTime;
      console.log(`🔗 에이전트 결과 종합 완료 (${processingTime}ms)`);

      // 결과 파싱
      const { title, content } = this.parseGeneratedContent(result);
      const consensusElements = this.extractListFromOutput(result, 'CONSENSUS_ELEMENTS');
      const resolvedConflicts = this.extractListFromOutput(result, 'RESOLVED_CONFLICTS');
      const synthesisConfidence = this.extractConfidenceFromOutput(result, 85);

      return {
        title,
        content,
        consensusElements,
        resolvedConflicts,
        synthesisConfidence,
      };
    } catch (error) {
      console.error('에이전트 결과 종합 오류:', error);
      throw new Error(`멀티 에이전트 결과 종합 중 오류가 발생했습니다: ${error.message}`);
    }
  }

  /**
   * 에이전트별 프롬프트 초기화
   */
  private initializeAgentPrompts(): void {
    // 작성자 에이전트 프롬프트
    this.writerPrompt = PromptTemplate.fromTemplate(`
## WRITER AGENT - CREATIVE CONTENT CREATOR WITH TOOLS
당신은 다양한 도구 결과를 활용하여 뛰어난 창의성과 스토리텔링을 구현하는 작성자입니다.

## WRITER'S MISSION
원본 요구사항: {topic}
핵심 인사이트: {keyInsight}
뉴스레터 유형: {newsletterType}

참고 자료 (도구 분석 결과 포함):
{scrapContent}

## ENHANCED DATA AVAILABLE
웹 검색 결과: {webSearchResults}
팩트체크 결과: {factCheckResults}
키워드 분석: {keywordResults}

## WRITER'S ENHANCED FOCUS AREAS
✅ 도구 결과를 자연스럽게 스토리에 통합
✅ 최신 정보와 트렌드를 활용한 시의적절한 내용
✅ 검증된 데이터로 신뢰성 확보
✅ 핵심 키워드를 자연스럽게 포함
✅ 독자의 감정에 호소하는 스토리텔링
✅ 창의적인 표현과 비유 사용
✅ 기억에 남는 메시지 전달
✅ 독자 행동을 유도하는 마무리

## TOOL INTEGRATION STRATEGY
- 웹 검색 결과는 최신성과 관련성을 위해 활용
- 팩트체크 결과는 신뢰성 확보를 위해 인용
- 키워드는 자연스럽게 문맥에 포함
- 모든 도구 결과는 스토리텔링에 유기적으로 통합

## 엄격한 한국어 출력 요구사항
❌ 절대 영어로 작성 금지
✅ 반드시 완전하고 세련된 한국어로만 작성
✅ 반드시 한국어 문법과 표현을 정확히 사용
✅ 반드시 한국 독자에게 적합한 문화적 맥락 반영

## OUTPUT FORMAT
WRITER_TITLE: [한국어로_작성된_창의적이고_매력적인_제목]
WRITER_CONTENT: [한국어로_작성된_매력적인_스토리텔링_콘텐츠]
CREATIVE_ELEMENTS: [사용된_독창적_요소들]
TOOL_INTEGRATION: [도구_결과_활용_방법]

작성자의 관점에서 도구 결과를 활용한 최고의 한국어 콘텐츠를 만들어주세요:
`);

    // 편집자 에이전트 프롬프트
    this.editorPrompt = PromptTemplate.fromTemplate(`
## EDITOR AGENT - QUALITY & CLARITY OPTIMIZER
당신은 명확성과 품질에 중점을 두는 전문 편집자입니다.

## EDITOR'S MISSION
원본 요구사항: {topic}
핵심 인사이트: {keyInsight}
뉴스레터 유형: {newsletterType}

참고 자료:
{scrapContent}

## EDITOR'S FOCUS AREAS
✅ 명확하고 간결한 문장 구조
✅ 논리적이고 체계적인 구성
✅ 문법과 맞춤법 완벽성
✅ 일관된 톤앤매너 유지
✅ 가독성 최적화

## EDITING CRITERIA
- 한 문장 = 한 아이디어
- 능동태 우선 사용
- 구체적 표현 선호
- 불필요한 수식어 제거
- 독자 친화적 언어 사용

## 엄격한 한국어 출력 요구사항
❌ 절대 영어로 작성 금지
✅ 반드시 완전하고 세련된 한국어로만 작성
✅ 반드시 한국어 문법과 표현을 정확히 사용
✅ 반드시 한국 독자에게 적합한 문화적 맥락 반영

## OUTPUT FORMAT
EDITOR_TITLE: [한국어로_최적화된_명확한_제목]
EDITOR_CONTENT: [한국어로_잘_구조화된_콘텐츠]
EDITING_IMPROVEMENTS: [명확성_개선사항]

편집자의 관점에서 최고 품질의 한국어 콘텐츠를 만들어주세요:
`);

    // 검토자 에이전트 프롬프트
    this.reviewerPrompt = PromptTemplate.fromTemplate(`
## REVIEWER AGENT - CRITICAL ANALYSIS SPECIALIST
당신은 객관적이고 비판적인 분석을 수행하는 검토 전문가입니다.

## REVIEWER'S MISSION
원본 요구사항: {topic}
핵심 인사이트: {keyInsight}
뉴스레터 유형: {newsletterType}

참고 자료:
{scrapContent}

## REVIEWER'S FOCUS AREAS
✅ 사실 정확성 검증
✅ 논리적 일관성 확인
✅ 독자 관점에서의 가치 평가
✅ 경쟁력 있는 차별화 요소 식별
✅ 잠재적 문제점 발견

## CRITICAL EVALUATION FRAMEWORK
- 주장의 근거가 충분한가?
- 독자가 실제로 얻는 가치는 무엇인가?
- 놓친 중요한 관점은 없는가?
- 더 강화할 수 있는 부분은?
- 제거해야 할 불필요한 요소는?

## 엄격한 한국어 출력 요구사항
❌ 절대 영어로 작성 금지
✅ 반드시 완전하고 세련된 한국어로만 작성
✅ 반드시 한국어 문법과 표현을 정확히 사용
✅ 반드시 한국 독자에게 적합한 문화적 맥락 반영

## OUTPUT FORMAT
REVIEWER_TITLE: [한국어로_비판적_평가된_제목]
REVIEWER_CONTENT: [한국어로_팩트체크된_콘텐츠]
CRITICAL_FEEDBACK: [객관적_분석과_제안사항]

검토자의 관점에서 객관적인 평가와 개선안을 한국어로 제시해주세요:
`);

    // 전략가 에이전트 프롬프트
    this.strategistPrompt = PromptTemplate.fromTemplate(`
## STRATEGIST AGENT - BUSINESS IMPACT OPTIMIZER
당신은 비즈니스 목표와 장기적 성과에 중점을 두는 전략 전문가입니다.

## STRATEGIST'S MISSION
원본 요구사항: {topic}
핵심 인사이트: {keyInsight}
뉴스레터 유형: {newsletterType}

참고 자료:
{scrapContent}

## STRATEGIST'S FOCUS AREAS
✅ 비즈니스 목표와의 정렬
✅ 타겟 오디언스 최적화
✅ 브랜드 포지셔닝 강화
✅ 측정 가능한 성과 창출
✅ 장기적 관계 구축

## STRATEGIC CONSIDERATIONS
- 이 콘텐츠가 브랜드에 미치는 영향은?
- 독자의 customer journey 상 어느 단계인가?
- 경쟁사 대비 차별화 포인트는?
- 다음 액션으로 이어질 가능성은?
- ROI 측정 가능한 요소들은?

## 엄격한 한국어 출력 요구사항
❌ 절대 영어로 작성 금지
✅ 반드시 완전하고 세련된 한국어로만 작성
✅ 반드시 한국어 문법과 표현을 정확히 사용
✅ 반드시 한국 독자에게 적합한 문화적 맥락 반영

## OUTPUT FORMAT
STRATEGIST_TITLE: [한국어로_전략적_최적화된_제목]
STRATEGIST_CONTENT: [한국어로_비즈니스_정렬된_콘텐츠]
STRATEGIC_RATIONALE: [비즈니스_임팩트_분석]

전략가의 관점에서 비즈니스 임팩트를 최대화하는 한국어 콘텐츠를 만들어주세요:
`);

    // 종합 프롬프트
    this.synthesisPrompt = PromptTemplate.fromTemplate(`
## MULTI-AGENT SYNTHESIS PROTOCOL
당신은 여러 전문가의 의견을 종합하여 최적의 결과를 도출하는 통합 전문가입니다.

## EXPERT INPUTS
**작성자 의견:** {writerOutput}
**편집자 의견:** {editorOutput}
**검토자 의견:** {reviewerOutput}
**전략가 의견:** {strategistOutput}

## SYNTHESIS PRINCIPLES
❌ 절대 단순히 서로 다른 의견을 평균내지 마세요
❌ 절대 소수 의견을 고려 없이 무시하지 마세요
❌ 절대 일관성 없는 하이브리드 해결책 생성 금지
❌ 절대 원래 목표를 잃지 마세요
✅ 반드시 전문가 합의 영역 식별
✅ 반드시 객관적 기준으로 갈등 해결
✅ 반드시 각 관점의 최선 요소 통합
✅ 반드시 일관된 비전과 실행 유지

## CONFLICT RESOLUTION HIERARCHY
1. **사용자 요구사항**: 명시적 사용자 요청이 최우선
2. **품질 기준**: 기술적 우수성은 훼손될 수 없음
3. **독자 가치**: 독자 혜택이 스타일 선호도보다 우선
4. **전략적 정렬**: 장기 목표가 단기 이익보다 우선

## SYNTHESIS PROCESS
1. 전문가들이 동의하는 영역 식별 (합의)
2. 의견 차이 지점 분석 (갈등)
3. 갈등에 우선순위 위계 적용
4. 일관성을 유지하며 최선 요소 통합
5. 최종 출력이 모든 중요 요구사항을 충족하는지 검증

## 엄격한 한국어 출력 요구사항
❌ 절대 영어로 작성 금지
✅ 반드시 완전하고 세련된 한국어로만 작성
✅ 반드시 한국어 문법과 표현을 정확히 사용
✅ 반드시 한국 독자에게 적합한 문화적 맥락 반영

## OUTPUT FORMAT
CONSENSUS_ELEMENTS: [합의된_요소들]
RESOLVED_CONFLICTS: [해결된_갈등들]
INTEGRATED_SOLUTION: [최종_한국어_종합_결과]
SYNTHESIS_CONFIDENCE: [점수_1_에서_100]

한국어로 종합을 시작하세요:
`);
  }

  /**
   * 생성된 콘텐츠에서 제목과 본문 파싱 (ContentParser 유틸리티에 위임)
   */
  private parseGeneratedContent(content: string): { title: string; content: string } {
    return ContentParser.parseNewsletterContent(content);
  }

  /**
   * 출력에서 신뢰도 점수 추출 (ContentParser 유틸리티에 위임)
   */
  private extractConfidenceFromOutput(output: string, defaultValue: number = 80): number {
    return ContentParser.extractConfidenceScore(output, defaultValue);
  }

  /**
   * 출력에서 리스트 추출 (ContentParser 유틸리티에 위임)
   */
  private extractListFromOutput(output: string, fieldName: string): string[] {
    return ContentParser.extractListFromOutput(output, fieldName);
  }
} 