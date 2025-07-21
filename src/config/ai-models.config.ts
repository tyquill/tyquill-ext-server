/**
 * AI 모델 설정 및 API 키 검증 유틸리티 (단순화됨)
 * 
 * @description 뉴스레터 생성에 사용되는 단일 AI 모델 설정을 관리합니다.
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
 * 단순화된 AI 모델 설정
 */
export interface AIModelsConfiguration {
  workflow: {
    main: AIModelConfig;
    scrapAnalysis: AIModelConfig;
  };
}

/**
 * 단일 AI 모델 설정
 */
export const AI_MODELS_CONFIG: AIModelsConfiguration = {
  workflow: {
    // 워크플로우 메인 모델 (유일한 모델)
    main: {
      model: 'gemini-2.5-pro',
      temperature: 0.7,
      maxOutputTokens: 10000,
    },
    scrapAnalysis: {
      model: 'gemini-2.5-flash',
      temperature: 0.7,
      maxOutputTokens: 10000,
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

  console.log('🤖 AI Models Configuration Loaded (Simplified):');
  console.log(`  - Workflow Models: ${Object.keys(AI_MODELS_CONFIG.workflow).length} model(s)`);
  
  const validation = validateEnvironment();
  if (validation.isValid) {
    console.log('✅ Google API Key validation passed');
  } else {
    console.log('❌ Configuration issues found:');
    validation.errors.forEach(error => console.log(`  - Error: ${error}`));
    validation.warnings.forEach(warning => console.log(`  - Warning: ${warning}`));
  }
}