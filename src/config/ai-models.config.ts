/**
 * AI 모델 설정 및 API 키 검증 유틸리티
 * 
 * @description 뉴스레터 생성에 사용되는 AI 모델들의 설정을 중앙 관리하고,
 * API 키 검증을 통해 안전한 모델 초기화를 보장합니다.
 */

/**
 * AI 모델 설정 인터페이스
 */
export interface AIModelConfig {
  model: string;
  temperature: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
}

/**
 * 뉴스레터 품질 서비스용 모델 설정들
 */
export interface QualityServiceModels {
  quality: AIModelConfig;
  reflection: AIModelConfig;
  correction: AIModelConfig;
}

/**
 * 뉴스레터 에이전트 서비스용 모델 설정들
 */
export interface AgentServiceModels {
  writer: AIModelConfig;
  editor: AIModelConfig;
  reviewer: AIModelConfig;
  strategist: AIModelConfig;
  synthesis: AIModelConfig;
}

/**
 * 전체 AI 모델 설정
 */
export interface AIModelsConfiguration {
  quality: QualityServiceModels;
  agents: AgentServiceModels;
  workflow: {
    main: AIModelConfig;
    strategist: AIModelConfig;
  };
}

/**
 * 기본 AI 모델 설정들
 */
export const AI_MODELS_CONFIG: AIModelsConfiguration = {
  quality: {
    // 품질 검증용 보수적 모델
    quality: {
      model: 'gemini-2.5-flash',
      temperature: 0.1, // 엄격한 평가
      maxOutputTokens: 2048,
    },
    // 리플렉션 전용 창의적 모델
    reflection: {
      model: 'gemini-2.5-flash',
      temperature: 0.8, // 창의적 분석
      maxOutputTokens: 2048,
    },
    // 자기 교정용 균형 모델
    correction: {
      model: 'gemini-2.5-flash',
      temperature: 0.5, // 균형적 개선
      maxOutputTokens: 2048,
    },
  },
  agents: {
    // 작성자 에이전트 - 창의적 콘텐츠 생성
    writer: {
      model: 'gemini-2.5-pro',
      temperature: 0.8,
      maxOutputTokens: 4096,
    },
    // 편집자 에이전트 - 구조 및 스타일 개선
    editor: {
      model: 'gemini-2.5-pro',
      temperature: 0.6,
      maxOutputTokens: 3072,
    },
    // 검토자 에이전트 - 비판적 분석
    reviewer: {
      model: 'gemini-2.5-pro',
      temperature: 0.4,
      maxOutputTokens: 2048,
    },
    // 전략가 에이전트 - 비즈니스 임팩트 최적화
    strategist: {
      model: 'gemini-2.5-pro',
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
    // 종합 에이전트 - 결과 통합
    synthesis: {
      model: 'gemini-2.5-pro',
      temperature: 0.5,
      maxOutputTokens: 4096,
    },
  },
  workflow: {
    // 워크플로우 메인 모델
    main: {
      model: 'gemini-2.5-pro',
      temperature: 0.6,
      maxOutputTokens: 4096,
    },
    // 워크플로우 전략 모델
    strategist: {
      model: 'gemini-2.5-pro',
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
  },
};

/**
 * API 키 검증 에러 클래스
 */
export class APIKeyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'APIKeyValidationError';
  }
}

/**
 * Google API 키 검증 및 반환
 * @throws {APIKeyValidationError} API 키가 설정되지 않은 경우
 */
export function validateAndGetGoogleAPIKey(): string {
  const apiKey = process.env.GOOGLE_API_KEY;
  
  if (!apiKey || apiKey.trim() === '') {
    throw new APIKeyValidationError(
      'GOOGLE_API_KEY environment variable is not set or empty. Please set your Google API key in the environment variables.'
    );
  }

  // API 키 형식 기본 검증 (Google API 키는 보통 39자리)
  if (apiKey.length < 20) {
    throw new APIKeyValidationError(
      'GOOGLE_API_KEY appears to be invalid. Google API keys are typically longer than 20 characters.'
    );
  }

  return apiKey;
}

/**
 * AI 모델 설정과 검증된 API 키를 결합하여 모델 초기화용 설정 반환
 * @param modelConfig AI 모델 설정
 * @returns 초기화용 설정 객체
 */
export function createModelInitConfig(modelConfig: AIModelConfig): any {
  const apiKey = validateAndGetGoogleAPIKey();
  
  return {
    ...modelConfig,
    apiKey,
  };
}

/**
 * 환경 변수 검증 (개발/테스트 환경에서 유용)
 */
export function validateEnvironment(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    validateAndGetGoogleAPIKey();
  } catch (error) {
    if (error instanceof APIKeyValidationError) {
      errors.push(error.message);
    }
  }

  // 추가 환경 변수 검증이 필요한 경우 여기에 추가
  const nodeEnv = process.env.NODE_ENV;
  if (!nodeEnv) {
    warnings.push('NODE_ENV is not set. Defaulting to development mode.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 개발 환경에서 설정 정보 출력 (디버깅용)
 */
export function logConfigurationInfo(): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  console.log('🤖 AI Models Configuration Loaded:');
  console.log(`  - Quality Models: ${Object.keys(AI_MODELS_CONFIG.quality).length} models`);
  console.log(`  - Agent Models: ${Object.keys(AI_MODELS_CONFIG.agents).length} models`);
  console.log(`  - Workflow Models: ${Object.keys(AI_MODELS_CONFIG.workflow).length} models`);
  
  const validation = validateEnvironment();
  if (validation.isValid) {
    console.log('✅ Google API Key validation passed');
  } else {
    console.log('❌ Configuration issues found:');
    validation.errors.forEach(error => console.log(`  - Error: ${error}`));
    validation.warnings.forEach(warning => console.log(`  - Warning: ${warning}`));
  }
} 