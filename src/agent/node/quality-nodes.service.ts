import { Injectable } from '@nestjs/common';
import { 
  NewsletterQualityService, 
  QualityValidationInput,
  SelfCorrectionInput 
} from '../newsletter-quality.service';
import { NewsletterStateAnnotation } from '../newsletter-workflow.service';

/**
 * 품질 노드 설정 인터페이스
 */
interface QualityNodeConfig {
  retryLimits: {
    maxSelfCorrectionAttempts: number;
  };
}

/**
 * 품질 관련 노드들을 처리하는 서비스
 * 
 * @description 뉴스레터 생성 워크플로우에서 품질 검증, 리플렉션 분석, 자기 교정을 담당합니다.
 */
@Injectable()
export class QualityNodesService {
  /**
   * 품질 노드 설정값들
   */
  private readonly config: QualityNodeConfig = {
    retryLimits: {
      maxSelfCorrectionAttempts: 2, // 최대 자기교정 시도 횟수
    },
  };

  constructor(
    private readonly qualityService: NewsletterQualityService,
  ) {}

  /**
   * 현재 retry 제한 설정 반환
   */
  public getRetryLimits(): { maxSelfCorrectionAttempts: number } {
    return { ...this.config.retryLimits };
  }

  /**
   * 품질 검증 노드
   * @param state 현재 워크플로우 상태
   * @returns 품질 검증 결과
   */
  async validateQuality(state: typeof NewsletterStateAnnotation.State): Promise<any> {
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
   * 리플렉션 분석 노드
   * @param state 현재 워크플로우 상태
   * @returns 리플렉션 분석 결과
   */
  async performReflectionAnalysis(state: typeof NewsletterStateAnnotation.State): Promise<any> {
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
   * 자기 교정 노드
   * @param state 현재 워크플로우 상태
   * @returns 자기 교정 결과
   */
  async performSelfCorrection(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    const processingSteps = [...(state.processingSteps || []), 'self_correction'];
    const reasoning = [...(state.reasoning || [])];
    const attempts = (state.selfCorrectionAttempts || 0) + 1;
    
    // 최대 횟수까지만 자기 교정 시도
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
   * 리플렉션 결과 기반 라우팅 함수
   * @param state 현재 워크플로우 상태
   * @returns 라우팅 결과
   */
  routeByReflectionResult(state: typeof NewsletterStateAnnotation.State): string {
    if (state.error) {
      return 'error';
    }
    
    const reflection = state.reflectionResult;
    const qualityMetrics = state.qualityMetrics;
    if (!reflection || !qualityMetrics) {
      return 'error';
    }

    // 재시도 횟수 확인
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
} 