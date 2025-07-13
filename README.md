# Tyquill Extension Server

AI 기반 뉴스레터 생성 서비스의 백엔드 서버입니다.

## 주요 기능

- 🤖 AI 기반 아티클 생성 (LangChain + Google Gemini)
- 📄 스크랩 데이터 관리 및 조합
- 📚 아티클 버전 관리
- 🏷️ 태그 시스템
- 👥 사용자 관리

## 기술 스택

- **Framework**: NestJS
- **Database**: PostgreSQL + MikroORM
- **AI**: LangChain + Google Gemini API
- **Language**: TypeScript

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 설정하세요:

```env
# 데이터베이스 설정
DATABASE_URL=postgresql://username:password@localhost:5432/tyquill_db

# AI 서비스 설정
GOOGLE_API_KEY=your_google_gemini_api_key_here

# 애플리케이션 설정
NODE_ENV=development
PORT=3000

# 로그 레벨
LOG_LEVEL=debug
```

### 3. 데이터베이스 마이그레이션

```bash
# 마이그레이션 실행
npx mikro-orm migration:up
```

### 4. 애플리케이션 실행

```bash
# 개발 모드
npm run start:dev

# 프로덕션 모드
npm run start:prod
```

## API 엔드포인트

### 아티클 생성 (AI)

```http
POST /api/v1/articles/generate?userId=1
Content-Type: application/json

{
  "topic": "AI 기술 동향 분석",
  "keyInsight": "AI 기술의 급속한 발전과 산업 적용 사례",
  "scrapIds": [1, 2, 3],
  "scrapComments": [
    {
      "scrapId": 1,
      "userComment": "최신 AI 기술 동향에 대한 깊이 있는 분석이 필요합니다."
    }
  ],
  "generationParams": "비즈니스 관점에서 실용적인 인사이트를 포함해주세요."
}
```

### 아티클 버전 조회

```http
GET /api/v1/articles/1/versions
```

## 테스트

### 단위 테스트

```bash
# 모든 단위 테스트 실행
npm run test

# 테스트 감시 모드
npm run test:watch

# 커버리지 포함 테스트
npm run test:cov
```

### E2E 테스트

```bash
# 모든 E2E 테스트 실행
npm run test:e2e

# 아티클 관련 E2E 테스트만 실행
npm run test:e2e:articles
```

### 프로덕션 환경 테스트

실제 API 키를 사용하여 프로덕션 환경과 동일한 조건에서 AI 생성 기능을 테스트합니다:

```bash
# 프로덕션 환경 테스트 실행
npm run test:production
```

**주의**: 프로덕션 테스트를 실행하기 전에 다음 사항을 확인하세요:
- ✅ `.env` 파일에 유효한 `GOOGLE_API_KEY` 설정
- ✅ 데이터베이스 연결 정상 작동
- ✅ 필요한 테이블 생성 완료

#### 프로덕션 테스트 내용

1. **🤖 기본 AI 생성 테스트**
   - 실제 Gemini API를 사용한 아티클 생성
   - 응답 시간 및 품질 검증

2. **🧠 복잡한 콘텐츠 생성 테스트**
   - 긴 스크랩 데이터를 활용한 고품질 콘텐츠 생성
   - 키워드 포함 여부 및 구조화 품질 검증

3. **⚡ 성능 테스트**
   - 다양한 길이의 콘텐츠 생성 성능 측정
   - 초당 생성량 계산

4. **🔍 품질 검증 테스트**
   - 주제별 콘텐츠 품질 검증
   - 제목 관련성 및 내용 일치성 확인

#### 테스트 결과 예시

```
🚀 프로덕션 환경 AI 생성 테스트 시작...

📝 테스트 데이터 준비 중...
   👤 사용자 생성 완료: Production Test User (ID: 1)
   📄 스크랩 2개 생성 완료
✅ 테스트 데이터 준비 완료

🤖 기본 AI 생성 테스트 시작...
   ⏱️  실행 시간: 8500ms
   📝 아티클 ID: 1
   📋 주제: AI 기술 동향과 비즈니스 적용 전략
   💡 핵심 인사이트: AI 기술의 급속한 발전이 다양한 산업에 미치는 영향과 기회
   🔗 연결된 스크랩: 2개
   📄 생성된 제목: "AI 혁신의 새로운 물결: 비즈니스 성공을 위한 전략적 접근"
   📊 콘텐츠 길이: 1,247자
   🔢 버전: 1
✅ 기본 AI 생성 테스트 완료

🎉 모든 테스트가 성공적으로 완료되었습니다!
```

## 개발 가이드

### 코드 스타일

- TypeScript 사용
- ESLint + Prettier 설정
- 함수명은 동사로 시작
- 클래스명은 PascalCase
- 파일명은 kebab-case

### 아키텍처

```
src/
├── api/                 # API 컨트롤러
│   ├── articles/
│   ├── scraps/
│   └── tags/
├── articles/           # 아티클 서비스 로직
│   ├── ai-generation.service.ts
│   ├── scrap-combination.service.ts
│   └── entities/
├── shared/             # 공통 서비스
└── users/              # 사용자 관리
```

## 라이선스

MIT License
