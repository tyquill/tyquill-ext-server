## 🔗 연관 이슈
<!-- Linear 이슈를 링크해주세요 -->
Closes: [CHI-XXX](https://linear.app/chill-mato/issue/CHI-XXX/)

## 📋 변경사항 요약
<!-- 이 PR에서 무엇을 변경했는지 간단히 설명해주세요 -->

### 주요 변경사항
- [ ] 새로운 API 엔드포인트 추가
- [ ] 기존 API 로직 수정
- [ ] 버그 수정
- [ ] 성능 최적화
- [ ] 보안 강화
- [ ] 리팩토링
- [ ] 타입 개선
- [ ] 데이터베이스 스키마 변경

## 🛠 구현 내용

### Backend 구조
- [ ] **Controllers** (`src/api/`)
  - [ ] 새로운 엔드포인트 추가
  - [ ] 기존 엔드포인트 수정
  - [ ] 요청/응답 DTO 업데이트
  - [ ] 유효성 검사 로직

- [ ] **Services** (`src/*/`)
  - [ ] 비즈니스 로직 구현
  - [ ] 데이터베이스 연산
  - [ ] 외부 API 연동
  - [ ] 캐싱 로직

- [ ] **Entities** (`src/*/entities/`)
  - [ ] MikroORM 엔티티 추가/수정
  - [ ] 관계 설정 (OneToMany, ManyToOne)
  - [ ] 데이터베이스 제약 조건
  - [ ] 인덱스 설정

- [ ] **Auth** (`src/auth/`)
  - [ ] JWT 인증 로직
  - [ ] OAuth 연동 (Google)
  - [ ] 권한 검증 (Guards)
  - [ ] 세션 관리

### AI 기능 (`src/agent/`)
- [ ] **LangChain 워크플로우**: AI 콘텐츠 생성
- [ ] **Google Gemini API**: 뉴스레터 생성
- [ ] **품질 평가**: 콘텐츠 품질 검증
- [ ] **프롬프트 템플릿**: 다양한 생성 템플릿

### 기술 스택
- [ ] **NestJS**: 모듈러 아키텍처
- [ ] **TypeScript**: 타입 안전성
- [ ] **MikroORM**: 데이터베이스 ORM
- [ ] **PostgreSQL**: 데이터베이스
- [ ] **JWT**: 인증/권한
- [ ] **LangChain**: AI 워크플로우

### 외부 API 연동
- [ ] **Google OAuth**: 사용자 인증
- [ ] **Google Gemini**: AI 콘텐츠 생성
- [ ] **Chrome Extension**: 클라이언트 연동
- [ ] **Maily/Substack**: 뉴스레터 발행

## 🗃️ 데이터베이스 변경사항

### 새로운 테이블/엔티티
- [ ] `users`: 사용자 정보
- [ ] `user_oauth`: OAuth 계정 연동
- [ ] `scraps`: 스크랩된 콘텐츠
- [ ] `articles`: 생성된 아티클
- [ ] `article_archive`: 아티클 버전 관리
- [ ] `tags`: 태그 시스템

### 마이그레이션
- [ ] 마이그레이션 스크립트 작성
- [ ] 기존 데이터 호환성 확인
- [ ] 롤백 계획 수립

## 🧪 테스트

### 테스트 범위
- [ ] **Unit Tests**: 서비스 로직 테스트
- [ ] **Integration Tests**: API 엔드포인트 테스트
- [ ] **E2E Tests**: 전체 플로우 테스트
- [ ] **Database Tests**: 데이터베이스 연산 테스트

### 테스트 결과
```bash
# 테스트 실행 결과를 여기에 붙여넣어주세요
npm run test
npm run test:e2e
npm run test:cov
```

### API 테스트 체크리스트
- [ ] **인증**: JWT 토큰 검증
- [ ] **권한**: 사용자별 접근 제어
- [ ] **유효성 검사**: 입력값 검증
- [ ] **에러 핸들링**: 예외 상황 처리
- [ ] **성능**: 응답 시간 측정

## 📸 API 문서/테스트 결과
<!-- API 변경사항이나 테스트 결과가 있다면 스크린샷을 첨부해주세요 -->

### Swagger/OpenAPI 문서
<!-- API 문서 스크린샷 또는 링크 -->

### Postman/Thunder Client 테스트
<!-- API 테스트 결과 스크린샷 -->

## 📦 빌드 & 배포

### 빌드 확인
- [ ] `npm run build` 성공
- [ ] `dist/` 폴더 정상 생성
- [ ] TypeScript 컴파일 에러 없음
- [ ] ESLint 통과

### 배포 환경 설정
- [ ] 환경 변수 설정 (.env)
- [ ] 데이터베이스 연결 설정
- [ ] 로그 설정
- [ ] 에러 모니터링 설정

### Docker 배포
- [ ] Dockerfile 작성/수정
- [ ] docker-compose.yml 설정
- [ ] 컨테이너 빌드 성공
- [ ] 헬스체크 엔드포인트 동작

## 📝 추가 정보

### Breaking Changes
- [ ] Breaking change 없음
- [ ] Breaking change 있음 (아래에 설명)

<!-- Breaking change가 있다면 설명해주세요 -->

### 보안 고려사항
- [ ] **SQL Injection**: 파라미터화된 쿼리 사용
- [ ] **XSS**: 입력값 이스케이프 처리
- [ ] **CSRF**: CSRF 토큰 검증
- [ ] **Rate Limiting**: API 호출 제한
- [ ] **데이터 암호화**: 민감 정보 암호화

### 성능 최적화
- [ ] **데이터베이스 쿼리**: N+1 문제 해결
- [ ] **캐싱**: Redis 캐시 활용
- [ ] **페이지네이션**: 대용량 데이터 처리
- [ ] **인덱스**: 데이터베이스 인덱스 최적화

## 👀 리뷰 포인트
<!-- 리뷰어가 특별히 봐줬으면 하는 부분이 있다면 -->
1. **보안**: API 보안 이슈 없는지
2. **성능**: 데이터베이스 쿼리 최적화
3. **타입 안전성**: TypeScript 타입 정확성
4. **에러 핸들링**: 예외 상황 처리 적절성
5. **테스트**: 테스트 커버리지 충분성

## 📚 참고 자료
<!-- 관련 문서나 참고한 자료가 있다면 -->
- [NestJS Documentation](https://docs.nestjs.com/)
- [MikroORM Documentation](https://mikro-orm.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [LangChain Documentation](https://js.langchain.com/docs/)
- [Google Gemini API](https://ai.google.dev/docs)

---

### 리뷰어 체크리스트
- [ ] TypeScript 타입 안전성 확보
- [ ] NestJS 모듈 구조 적절성
- [ ] 데이터베이스 설계 검토
- [ ] 보안 가이드라인 준수
- [ ] 성능 최적화 (쿼리, 메모리)
- [ ] 테스트 커버리지 충분성
- [ ] API 문서 업데이트
- [ ] 에러 핸들링 적절성