# Langfuse Prompt Management Migration Guide

이 문서는 로컬 프롬프트 관리에서 Langfuse 기반 프롬프트 관리로 마이그레이션하는 과정을 설명합니다.

## 개요

기존에는 프롬프트를 TypeScript 코드에 하드코딩하여 관리했지만, 이제 Langfuse를 통해 중앙 집중식으로 관리합니다.

### 장점

- ✅ **중앙 집중식 관리**: 모든 프롬프트를 한 곳에서 관리
- ✅ **버전 관리**: 프롬프트 변경 이력 추적 및 롤백 가능
- ✅ **배포 없이 업데이트**: 코드 재배포 없이 프롬프트 변경 가능
- ✅ **A/B 테스팅**: 다양한 프롬프트 버전 테스트 가능
- ✅ **성능 분석**: 프롬프트별 성능 메트릭 확인
- ✅ **캐싱**: 자동 캐싱으로 성능 최적화
- ✅ **제로 레이턴시**: 시작 시 프리페치로 첫 사용부터 빠른 응답

## 마이그레이션된 프롬프트

### Newsletter Prompts (9개)
- `newsletter-simple` - 영어 뉴스레터 생성
- `newsletter-simple-title` - 영어 뉴스레터 제목 생성
- `newsletter-article-reflector` - 영어 뉴스레터 피드백
- `newsletter-writing-style-rewrite` - 영어 문체 변환
- `newsletter-structure-analysis` - 구조 분석
- `newsletter-korean` - 한국어 뉴스레터 생성
- `newsletter-korean-title` - 한국어 뉴스레터 제목 생성
- `newsletter-korean-article-reflector` - 한국어 뉴스레터 피드백
- `newsletter-korean-writing-style-rewrite` - 한국어 문체 변환

### Repurpose Prompts (9개)
- `repurpose-blog` - 블로그 포스트 변환
- `repurpose-twitter` - 트위터 스레드 변환
- `repurpose-linkedin` - 링크드인 포스트 변환
- `repurpose-instagram` - 인스타그램 캡션 변환
- `repurpose-youtube` - 유튜브 스크립트 변환
- `repurpose-tiktok` - 틱톡 스크립트 변환
- `repurpose-email` - 이메일 뉴스레터 변환
- `repurpose-podcast` - 팟캐스트 스크립트 변환
- `repurpose-custom` - 커스텀 포맷 변환

## 설정 방법

### 1. 환경 변수 설정

`.env` 파일에 Langfuse 자격 증명을 추가하세요:

```env
# Langfuse Observability & Prompt Management
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
# or for US region: https://us.cloud.langfuse.com
```

### 2. Langfuse 계정 생성

1. [Langfuse Cloud](https://cloud.langfuse.com) 또는 [US Region](https://us.cloud.langfuse.com)에서 계정 생성
2. 새 프로젝트 생성
3. API Keys 페이지에서 Secret Key와 Public Key 복사

### 3. 프롬프트 업로드

마이그레이션 스크립트를 실행하여 모든 프롬프트를 Langfuse에 업로드:

```bash
cd backend
npm run prompts:upload
```

**출력 예시:**
```
🚀 Starting prompt upload to Langfuse...

📍 Base URL: https://cloud.langfuse.com

📝 Uploading prompt: newsletter-simple
✅ Successfully uploaded: newsletter-simple

...

📊 Upload Summary:
✅ Success: 18/18
❌ Failed: 0/18

🎉 All prompts uploaded successfully!
```

### 4. Langfuse UI에서 확인

1. Langfuse 대시보드에 로그인
2. **Prompts** 페이지로 이동
3. 업로드된 18개의 프롬프트 확인

## 아키텍처 변경 사항

### 이전 (로컬 관리)

```typescript
@Injectable()
export class NewsletterPromptTemplatesService {
  private readonly simpleNewsletterTemplate: PromptTemplate;

  constructor() {
    // 프롬프트가 코드에 하드코딩됨
    this.simpleNewsletterTemplate = PromptTemplate.fromTemplate(`...`);
  }

  getSimpleNewsletterTemplate(): PromptTemplate {
    return this.simpleNewsletterTemplate;
  }
}
```

### 이후 (Langfuse 관리)

```typescript
@Injectable()
export class NewsletterPromptTemplatesService implements OnModuleInit {
  constructor(private readonly langfusePromptService: LangfusePromptService) {}

  async onModuleInit() {
    // 시작 시 모든 프롬프트 프리페치 (제로 레이턴시)
    await this.prefetchPrompts();
  }

  async getSimpleNewsletterTemplate(): Promise<PromptTemplate> {
    // Langfuse에서 프롬프트 가져오기 (캐싱됨)
    return this.getPromptTemplate('newsletter-simple');
  }
}
```

## 캐싱 메커니즘

### 다층 캐싱 전략

1. **Langfuse SDK 캐싱** (기본 60초 TTL)
   - Langfuse 클라이언트가 자동으로 프롬프트 캐싱
   - 네트워크 요청 최소화

2. **애플리케이션 레벨 캐싱** (60초 TTL)
   - `NewsletterPromptTemplatesService`와 `RepurposePromptTemplatesService`에서 추가 캐싱
   - 더 빠른 응답 시간

3. **시작 시 프리페칭**
   - `OnModuleInit`에서 모든 프롬프트 사전 로드
   - 첫 요청부터 제로 레이턴시

### Fallback 전략

```typescript
private async getPromptTemplate(name: string): Promise<PromptTemplate> {
  // 1. 캐시 확인 (60초 TTL)
  const cached = this.promptCache.get(name);
  if (cached && !isStale(cached)) {
    return cached.template;
  }

  // 2. Langfuse에서 페치 시도
  try {
    const template = await this.langfusePromptService.getPrompt(name);
    this.promptCache.set(name, { template, timestamp: Date.now() });
    return template;
  } catch (error) {
    // 3. 페치 실패 시 오래된 캐시라도 사용 (Graceful degradation)
    if (cached) {
      this.logger.warn(`Using stale cached prompt for '${name}'`);
      return cached.template;
    }
    throw error;
  }
}
```

## 프롬프트 업데이트 방법

### Langfuse UI에서 업데이트

1. Langfuse 대시보드의 **Prompts** 페이지로 이동
2. 수정하고 싶은 프롬프트 선택
3. **Edit** 버튼 클릭
4. 프롬프트 내용 수정
5. **Save** 클릭 (자동으로 새 버전 생성)
6. **Promote to Production** 클릭하여 프로덕션에 배포

### SDK를 통한 업데이트

```typescript
import { LangfuseClient } from '@langfuse/client';

const langfuse = new LangfuseClient({
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL,
});

await langfuse.prompt.create({
  name: 'newsletter-simple',
  prompt: '새로운 프롬프트 내용...',
  type: 'text',
  labels: ['production'],
});
```

### 변경 사항 자동 반영

- 캐시 TTL(60초) 이후 자동으로 새 버전 사용
- 즉시 적용이 필요한 경우 서버 재시작

## 모니터링 및 분석

### Langfuse에서 확인 가능한 메트릭

1. **프롬프트 사용 통계**
   - 각 프롬프트의 호출 횟수
   - 버전별 사용 현황

2. **성능 메트릭**
   - 응답 시간
   - 토큰 사용량
   - 비용

3. **품질 메트릭**
   - 사용자 피드백
   - 생성 품질 점수

## 트러블슈팅

### 프롬프트를 찾을 수 없음

**증상:**
```
Failed to load prompt 'newsletter-simple' from Langfuse
```

**해결 방법:**
1. Langfuse UI에서 프롬프트가 존재하는지 확인
2. 프롬프트 이름이 정확한지 확인
3. 'production' 레이블이 있는지 확인
4. 업로드 스크립트 재실행: `npm run prompts:upload`

### Langfuse 연결 실패

**증상:**
```
Langfuse client is not initialized. Please check your configuration.
```

**해결 방법:**
1. `.env` 파일의 Langfuse 자격 증명 확인
2. `LANGFUSE_BASE_URL`이 올바른지 확인
3. 네트워크 연결 확인
4. API 키가 유효한지 Langfuse UI에서 확인

### 캐시 문제

프롬프트가 업데이트되었는데 이전 버전이 계속 사용되는 경우:

**해결 방법:**
1. 60초 대기 (캐시 TTL)
2. 서버 재시작
3. 캐시 수동 클리어 (향후 API 엔드포인트 추가 예정)

## 베스트 프랙티스

### 1. 프롬프트 버전 관리

- 중요한 변경 전에는 항상 새 버전 생성
- Production 레이블은 신중하게 사용
- 테스트용으로 'staging' 레이블 활용

### 2. 프롬프트 네이밍

- 명확하고 일관된 네이밍 규칙 사용
- 카테고리별로 prefix 사용 (예: `newsletter-`, `repurpose-`)
- 언어별로 suffix 사용 (예: `-korean`, `-english`)

### 3. 캐싱 최적화

- 자주 사용되는 프롬프트는 더 긴 TTL 설정 고려
- 드물게 사용되는 프롬프트는 캐싱 비활성화 고려
- 메모리 사용량 모니터링

### 4. 모니터링

- Langfuse 대시보드를 정기적으로 확인
- 프롬프트 성능 메트릭 추적
- 이상 패턴 발견 시 즉시 조치
