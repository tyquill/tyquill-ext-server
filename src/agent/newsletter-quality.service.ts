import { Injectable } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { NewsletterPromptTemplatesService } from './newsletter-prompt-templates.service';
import { 
  AI_MODELS_CONFIG, 
  createModelInitConfig, 
  APIKeyValidationError,
  logConfigurationInfo 
} from '../config/ai-models.config';

// 향상된 품질 메트릭 정의
export interface QualityMetrics {
  clarity: number; // 명확성 (1-10)
  engagement: number; // 참여도 (1-10)
  accuracy: number; // 정확성 (1-10)
  completeness: number; // 완성도 (1-10)
  creativity: number; // 창의성 (1-10)
  persuasiveness: number; // 설득력 (1-10)
  overall: number; // 전체 점수 (1-10)
  confidence: number; // AI 신뢰도 (1-100)
}

// 리플렉션 결과 인터페이스
export interface ReflectionResult {
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  confidence: number;
  needsRevision: boolean;
}

export interface QualityValidationInput {
  title: string;
  content: string;
  newsletterType: string;
  topic: string;
}

export interface SelfCorrectionInput {
  originalTitle: string;
  originalContent: string;
  weaknesses: string[];
  improvements: string[];
}

export interface SelfCorrectionResult {
  correctedTitle: string;
  correctedContent: string;
  fixesApplied: string[];
  confidence: number;
}

@Injectable()
export class NewsletterQualityService {
  private readonly qualityModel: ChatGoogleGenerativeAI;
  private readonly reflectionModel: ChatGoogleGenerativeAI;
  private readonly correctionModel: ChatGoogleGenerativeAI;

  constructor(
    private readonly promptTemplatesService: NewsletterPromptTemplatesService,
  ) {
    try {
      // 개발 환경에서 설정 정보 출력
      logConfigurationInfo();

      // 품질 검증용 보수적 모델 (설정 파일에서 로드)
      this.qualityModel = new ChatGoogleGenerativeAI(
        createModelInitConfig(AI_MODELS_CONFIG.quality.quality)
      );

      // 리플렉션 전용 창의적 모델 (설정 파일에서 로드)
      this.reflectionModel = new ChatGoogleGenerativeAI(
        createModelInitConfig(AI_MODELS_CONFIG.quality.reflection)
      );

      // 자기 교정용 균형 모델 (설정 파일에서 로드)
      this.correctionModel = new ChatGoogleGenerativeAI(
        createModelInitConfig(AI_MODELS_CONFIG.quality.correction)
      );

      console.log('✅ NewsletterQualityService: AI models initialized successfully');
    } catch (error) {
      if (error instanceof APIKeyValidationError) {
        console.error('❌ NewsletterQualityService initialization failed:', error.message);
        throw new Error(`Failed to initialize AI models: ${error.message}`);
      }
      console.error('❌ Unexpected error during NewsletterQualityService initialization:', error);
      throw error;
    }
  }

  /**
   * 품질 검증 실행
   */
  async validateQuality(input: QualityValidationInput): Promise<{
    qualityMetrics: QualityMetrics;
    validationIssues: string[];
    suggestions: string[];
  }> {
    const startTime = Date.now();
    
    try {
      console.log('📊 품질 검증 시작');
      
      const template = this.promptTemplatesService.getQualityValidationTemplate();
      const chain = template.pipe(this.qualityModel).pipe(new StringOutputParser());
      
      const result = await chain.invoke({
        title: input.title,
        content: input.content,
        newsletterType: input.newsletterType,
      });

      // 확장된 메트릭 파싱
      const clarityMatch = result.match(/CLARITY:\s*(\d+)/i);
      const engagementMatch = result.match(/ENGAGEMENT:\s*(\d+)/i);
      const accuracyMatch = result.match(/ACCURACY:\s*(\d+)/i);
      const completenessMatch = result.match(/COMPLETENESS:\s*(\d+)/i);
      const creativityMatch = result.match(/CREATIVITY:\s*(\d+)/i);
      const persuasivenessMatch = result.match(/PERSUASIVENESS:\s*(\d+)/i);
      const confidenceMatch = result.match(/CONFIDENCE:\s*(\d+)/i);
      const issuesMatch = result.match(/ISSUES:\s*(.+)/i);
      const suggestionsMatch = result.match(/SUGGESTIONS:\s*(.+)/i);

      const clarity = clarityMatch ? parseInt(clarityMatch[1]) : 5;
      const engagement = engagementMatch ? parseInt(engagementMatch[1]) : 5;
      const accuracy = accuracyMatch ? parseInt(accuracyMatch[1]) : 5;
      const completeness = completenessMatch ? parseInt(completenessMatch[1]) : 5;
      const creativity = creativityMatch ? parseInt(creativityMatch[1]) : 5;
      const persuasiveness = persuasivenessMatch ? parseInt(persuasivenessMatch[1]) : 5;
      const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 50;
      const overall = Math.round((clarity + engagement + accuracy + completeness + creativity + persuasiveness) / 6);

      const qualityMetrics: QualityMetrics = {
        clarity,
        engagement,
        accuracy,
        completeness,
        creativity,
        persuasiveness,
        overall,
        confidence,
      };

      const validationIssues = issuesMatch && issuesMatch[1].trim().toLowerCase() !== 'none' 
        ? [issuesMatch[1].trim()] 
        : [];
      
      const suggestions = suggestionsMatch && suggestionsMatch[1].trim().toLowerCase() !== 'none'
        ? [suggestionsMatch[1].trim()]
        : [];

      const processingTime = Date.now() - startTime;
      console.log(`✅ 품질 검증 완료 (${processingTime}ms) - 전체 점수: ${overall}/10`);

      return {
        qualityMetrics,
        validationIssues,
        suggestions,
      };
    } catch (error) {
      console.error('품질 검증 오류:', error);
      throw new Error(`품질 검증 중 오류가 발생했습니다: ${error.message}`);
    }
  }

  /**
   * 리플렉션 분석 실행
   */
  async performReflectionAnalysis(input: QualityValidationInput): Promise<ReflectionResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 리플렉션 분석 시작');
      
      const template = this.promptTemplatesService.getReflectionTemplate();
      const chain = template.pipe(this.reflectionModel).pipe(new StringOutputParser());
      
      const result = await chain.invoke({
        title: input.title,
        content: input.content,
        newsletterType: input.newsletterType,
        topic: input.topic,
      });

      // 리플렉션 결과 파싱
      const strengthsMatch = result.match(/STRENGTHS:\s*(.+)/i);
      const weaknessesMatch = result.match(/WEAKNESSES:\s*(.+)/i);
      const improvementsMatch = result.match(/IMPROVEMENTS:\s*(.+)/i);
      const confidenceMatch = result.match(/CONFIDENCE:\s*(\d+)/i);
      const needsRevisionMatch = result.match(/NEEDS_REVISION:\s*(YES|NO)/i);

      const reflectionResult: ReflectionResult = {
        strengths: strengthsMatch ? strengthsMatch[1].split('|').map(s => s.trim()) : [],
        weaknesses: weaknessesMatch ? weaknessesMatch[1].split('|').map(w => w.trim()) : [],
        improvements: improvementsMatch ? improvementsMatch[1].split('|').map(i => i.trim()) : [],
        confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 50,
        needsRevision: needsRevisionMatch ? needsRevisionMatch[1].toUpperCase() === 'YES' : false,
      };

      const processingTime = Date.now() - startTime;
      console.log(`🧠 리플렉션 분석 완료 (${processingTime}ms) - 신뢰도: ${reflectionResult.confidence}%`);

      return reflectionResult;
    } catch (error) {
      console.error('리플렉션 분석 오류:', error);
      throw new Error(`리플렉션 분석 중 오류가 발생했습니다: ${error.message}`);
    }
  }

  /**
   * 자기 교정 실행
   */
  async performSelfCorrection(input: SelfCorrectionInput): Promise<SelfCorrectionResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔧 자기 교정 시작');
      
      const template = this.promptTemplatesService.getSelfCorrectionTemplate();
      const chain = template.pipe(this.correctionModel).pipe(new StringOutputParser());
      
      const weaknesses = input.weaknesses.join(', ') || '식별된 약점 없음';
      const improvements = input.improvements.join(', ') || '제안된 개선사항 없음';
      
      const result = await chain.invoke({
        originalTitle: input.originalTitle,
        originalContent: input.originalContent,
        weaknesses,
        improvements,
      });

      // 교정 결과 파싱
      const titleMatch = result.match(/CORRECTED_TITLE:\s*(.+)/i);
      const contentMatch = result.match(/CORRECTED_CONTENT:\s*([\s\S]+?)(?=FIXES_APPLIED:|$)/i);
      const fixesMatch = result.match(/FIXES_APPLIED:\s*(.+)/i);

      const correctedTitle = titleMatch ? titleMatch[1].trim() : input.originalTitle;
      const correctedContent = contentMatch ? contentMatch[1].trim() : input.originalContent;
      const fixesApplied = fixesMatch ? fixesMatch[1].split('|').map(fix => fix.trim()) : [];
      
      // 개선 신뢰도 계산 (수정 사항의 수와 유형에 따라)
      const confidence = this.calculateCorrectionConfidence(fixesApplied, input.weaknesses);

      const processingTime = Date.now() - startTime;
      console.log(`🛠️ 자기 교정 완료 (${processingTime}ms) - ${fixesApplied.length}개 수정사항 적용`);

      return {
        correctedTitle,
        correctedContent,
        fixesApplied,
        confidence,
      };
    } catch (error) {
      console.error('자기 교정 오류:', error);
      throw new Error(`자기 교정 중 오류가 발생했습니다: ${error.message}`);
    }
  }

  /**
   * 품질 점수 기반 개선 필요성 판단
   */
  needsImprovement(qualityMetrics: QualityMetrics): boolean {
    // 전체 점수가 7 미만이거나, 어떤 메트릭이 5 미만인 경우
    return qualityMetrics.overall < 7 || 
           qualityMetrics.clarity < 5 ||
           qualityMetrics.engagement < 5 ||
           qualityMetrics.accuracy < 5 ||
           qualityMetrics.completeness < 5 ||
           qualityMetrics.creativity < 5 ||
           qualityMetrics.persuasiveness < 5;
  }

  /**
   * 리플렉션 결과 기반 수정 필요성 판단
   */
  needsRevisionByReflection(
    reflectionResult: ReflectionResult, 
    qualityMetrics: QualityMetrics,
    attempts: number = 0
  ): boolean {
    // 최대 시도 횟수 확인
    if (attempts >= 2) {
      return false; // 무한 루프 방지
    }

    // 신뢰도와 품질 점수를 종합적으로 고려
    const confidence = reflectionResult.confidence;
    const weaknessCount = reflectionResult.weaknesses.length;
    const overall = qualityMetrics.overall;

    // 높은 품질: 신뢰도 80% 이상, 전체 점수 8 이상, 약점 1개 이하
    if (confidence >= 80 && overall >= 8 && weaknessCount <= 1) {
      return false;
    }

    // 중간 품질에서 첫 번째 시도: 신뢰도 60% 이상, 전체 점수 6 이상, 약점 3개 이하
    if (confidence >= 60 && overall >= 6 && weaknessCount <= 3 && attempts < 1) {
      return true;
    }

    // 그 외의 경우 개선 시도 없이 완료
    return false;
  }

  /**
   * 종합적인 품질 평가
   */
  async performComprehensiveQualityCheck(input: QualityValidationInput): Promise<{
    qualityMetrics: QualityMetrics;
    reflectionResult: ReflectionResult;
    validationIssues: string[];
    suggestions: string[];
    needsImprovement: boolean;
    recommendedActions: string[];
  }> {
    const startTime = Date.now();
    
    try {
      console.log('🔬 종합 품질 검사 시작');

      // 병렬로 품질 검증과 리플렉션 분석 실행
      const [qualityResult, reflectionResult] = await Promise.all([
        this.validateQuality(input),
        this.performReflectionAnalysis(input),
      ]);

      const needsImprovement = this.needsImprovement(qualityResult.qualityMetrics);
      const needsRevision = this.needsRevisionByReflection(reflectionResult, qualityResult.qualityMetrics);

      // 권장 액션 생성
      const recommendedActions: string[] = [];
      
      if (needsImprovement) {
        recommendedActions.push('품질 메트릭 개선 필요');
      }
      
      if (needsRevision) {
        recommendedActions.push('리플렉션 기반 수정 권장');
      }

      if (qualityResult.qualityMetrics.overall >= 8 && reflectionResult.confidence >= 80) {
        recommendedActions.push('고품질 달성 - 배포 준비 완료');
      }

      const processingTime = Date.now() - startTime;
      console.log(`📋 종합 품질 검사 완료 (${processingTime}ms)`);

      return {
        qualityMetrics: qualityResult.qualityMetrics,
        reflectionResult,
        validationIssues: qualityResult.validationIssues,
        suggestions: qualityResult.suggestions,
        needsImprovement: needsImprovement || needsRevision,
        recommendedActions,
      };
    } catch (error) {
      console.error('종합 품질 검사 오류:', error);
      throw new Error(`종합 품질 검사 중 오류가 발생했습니다: ${error.message}`);
    }
  }

  /**
   * 교정 신뢰도 계산
   */
  private calculateCorrectionConfidence(fixesApplied: string[], originalWeaknesses: string[]): number {
    if (fixesApplied.length === 0) {
      return 50; // 수정사항이 없으면 중간 신뢰도
    }

    // 수정사항 개수와 원래 약점 개수 비교
    const fixRatio = Math.min(fixesApplied.length / Math.max(originalWeaknesses.length, 1), 1);
    
    // 기본 신뢰도 60% + 수정 비율에 따른 추가 점수 (최대 30%)
    const confidence = 60 + (fixRatio * 30);
    
    return Math.round(Math.min(confidence, 95)); // 최대 95%로 제한
  }

  /**
   * 품질 향상 추천 사항 생성
   */
  generateQualityRecommendations(
    qualityMetrics: QualityMetrics,
    reflectionResult: ReflectionResult
  ): string[] {
    const recommendations: string[] = [];

    // 메트릭별 권장사항
    if (qualityMetrics.clarity < 7) {
      recommendations.push('문장 구조를 더 명확하게 개선하세요');
    }

    if (qualityMetrics.engagement < 7) {
      recommendations.push('독자 참여를 유도하는 요소를 추가하세요');
    }

    if (qualityMetrics.accuracy < 7) {
      recommendations.push('팩트체크와 데이터 검증을 강화하세요');
    }

    if (qualityMetrics.creativity < 7) {
      recommendations.push('더 창의적이고 독창적인 접근을 시도하세요');
    }

    if (qualityMetrics.persuasiveness < 7) {
      recommendations.push('논리적 근거와 설득력을 보강하세요');
    }

    // 리플렉션 기반 권장사항
    if (reflectionResult.weaknesses.length > 2) {
      recommendations.push('식별된 약점들을 우선적으로 개선하세요');
    }

    if (reflectionResult.confidence < 70) {
      recommendations.push('콘텐츠의 일관성과 완성도를 검토하세요');
    }

    return recommendations;
  }
} 