import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EntityManager } from '@mikro-orm/core';
import { User } from '../src/users/entities/user.entity';
import { Scrap } from '../src/scraps/entities/scrap.entity';
import { Article } from '../src/articles/entities/article.entity';
import { ArticleArchive } from '../src/article-archive/entities/article-archive.entity';
import { ArticlesService } from '../src/articles/articles.service';
import { GenerateArticleDto } from '../src/api/articles/dto/create-article.dto';

/**
 * 실제 프로덕션 환경과 동일한 조건에서 AI 생성 기능을 테스트하는 스크립트
 */
async function runProductionTest() {
  console.log('🚀 프로덕션 환경 AI 생성 테스트 시작...\n');

  const app = await NestFactory.create(AppModule);
  const em = app.get(EntityManager);
  const articlesService = app.get(ArticlesService);

  try {
    // 1. 테스트 데이터 준비
    console.log('📝 테스트 데이터 준비 중...');
    const forkedEm = em.fork();
    const testUser = await setupTestUser(forkedEm);
    const testScraps = await setupTestScraps(forkedEm, testUser);
    console.log('✅ 테스트 데이터 준비 완료\n');

    // 2. 기본 AI 생성 테스트
    console.log('🤖 기본 AI 생성 테스트 시작...');
    await testBasicAiGeneration(articlesService, testUser.userId, testScraps);
    console.log('✅ 기본 AI 생성 테스트 완료\n');

    // 3. 복잡한 콘텐츠 생성 테스트
    console.log('🧠 복잡한 콘텐츠 생성 테스트 시작...');
    const complexScrap = await setupComplexScrap(forkedEm, testUser);
    await testComplexAiGeneration(articlesService, testUser.userId, [complexScrap]);
    console.log('✅ 복잡한 콘텐츠 생성 테스트 완료\n');

    // 4. 성능 테스트
    console.log('⚡ 성능 테스트 시작...');
    await testPerformance(articlesService, testUser.userId, testScraps);
    console.log('✅ 성능 테스트 완료\n');

    // 5. 품질 검증 테스트
    console.log('🔍 품질 검증 테스트 시작...');
    await testQualityValidation(articlesService, testUser.userId, testScraps);
    console.log('✅ 품질 검증 테스트 완료\n');

    console.log('🎉 모든 테스트가 성공적으로 완료되었습니다!');

  } catch (error) {
    console.error('❌ 테스트 실행 중 오류 발생:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

async function setupTestUser(em: EntityManager): Promise<User> {
  // 기존 테스트 데이터 정리 (외래 키 제약 순서 고려)
  await em.nativeDelete(ArticleArchive, {});
  await em.nativeDelete(Article, {});
  await em.nativeDelete(Scrap, {});
  await em.nativeDelete(User, { email: 'production-test@example.com' });

  const user = new User();
  user.email = 'production-test@example.com';
  user.name = 'Production Test User';
  await em.persistAndFlush(user);
  
  console.log(`   👤 사용자 생성 완료: ${user.name} (ID: ${user.userId})`);
  return user;
}

async function setupTestScraps(em: EntityManager, user: User): Promise<Scrap[]> {
  const scraps: Scrap[] = [];

  // 기술 뉴스 스크랩
  const techScrap = new Scrap();
  techScrap.url = 'https://example.com/tech-news';
  techScrap.title = 'AI 기술 혁신과 산업 적용 현황';
  techScrap.content = `
    최근 AI 기술의 발전 속도가 가속화되고 있습니다. 
    특히 생성형 AI 분야에서는 ChatGPT, GPT-4, Claude 등의 대규모 언어 모델이 
    다양한 산업에서 실용적으로 활용되고 있습니다.
    
    주요 적용 분야:
    - 콘텐츠 생성 및 편집
    - 고객 서비스 자동화
    - 코드 생성 및 리뷰
    - 데이터 분석 및 인사이트 도출
    - 언어 번역 및 요약
    
    기업들은 AI 도입을 통해 생산성 향상과 비용 절감을 동시에 달성하고 있으며,
    이러한 트렌드는 앞으로도 계속될 것으로 예상됩니다.
  `;
  techScrap.htmlContent = '<div>AI 기술 혁신 관련 HTML 콘텐츠</div>';
  techScrap.userComment = 'AI 기술의 실제 비즈니스 적용 사례와 ROI에 대한 구체적인 분석이 필요합니다.';
  techScrap.user = user;
  scraps.push(techScrap);

  // 시장 동향 스크랩
  const marketScrap = new Scrap();
  marketScrap.url = 'https://example.com/market-trends';
  marketScrap.title = '2024 글로벌 기술 시장 전망';
  marketScrap.content = `
    2024년 글로벌 기술 시장은 다음과 같은 주요 트렌드를 보일 것으로 예상됩니다:
    
    1. 인공지능 시장 확대
       - 시장 규모: 1,800억 달러 (전년 대비 25% 증가)
       - 주요 성장 동력: 생성형 AI, 자동화 솔루션
    
    2. 클라우드 컴퓨팅 지속 성장
       - 하이브리드 클라우드 솔루션 수요 증가
       - 엣지 컴퓨팅과의 융합 가속화
    
    3. 사이버보안 투자 확대
       - 제로 트러스트 보안 모델 도입 증가
       - AI 기반 보안 솔루션 개발
    
    4. 지속가능한 기술 발전
       - 그린 IT 솔루션 투자 증가
       - 탄소 중립 데이터센터 구축
  `;
  marketScrap.htmlContent = '<div>시장 전망 관련 HTML 콘텐츠</div>';
  marketScrap.userComment = '시장 데이터와 함께 우리 회사의 전략적 포지셔닝 방안을 제시해주세요.';
  marketScrap.user = user;
  scraps.push(marketScrap);

  await em.persistAndFlush(scraps);
  
  console.log(`   📄 스크랩 ${scraps.length}개 생성 완료`);
  return scraps;
}

async function setupComplexScrap(em: EntityManager, user: User): Promise<Scrap> {
  const complexScrap = new Scrap();
  complexScrap.url = 'https://example.com/complex-analysis';
  complexScrap.title = '엔터프라이즈 AI 도입 전략과 실행 방안';
  complexScrap.content = `
    엔터프라이즈 환경에서 AI 도입은 단순한 기술 적용을 넘어 
    조직 전체의 디지털 트랜스포메이션을 의미합니다.
    
    ## 도입 전략 프레임워크
    
    ### 1. 현황 분석 (As-Is Analysis)
    - 기존 비즈니스 프로세스 분석
    - 데이터 인프라 현황 평가
    - 조직 역량 및 문화 진단
    - 기술 스택 호환성 검토
    
    ### 2. 목표 설정 (To-Be Vision)
    - 비즈니스 목표와 AI 전략 연계
    - KPI 및 성과 지표 정의
    - 투자 대비 효과 (ROI) 예측
    - 리스크 관리 계획 수립
    
    ### 3. 실행 로드맵 (Implementation Roadmap)
    
    #### Phase 1: 파일럿 프로젝트 (3-6개월)
    - 저위험, 고효과 영역 선정
    - 개념 증명 (PoC) 실행
    - 초기 성과 측정 및 학습
    
    #### Phase 2: 확장 적용 (6-12개월)
    - 성공 사례 기반 확장
    - 부서별 맞춤형 솔루션 개발
    - 데이터 거버넌스 체계 구축
    
    #### Phase 3: 전사 확산 (12-24개월)
    - 엔터프라이즈 AI 플랫폼 구축
    - 조직 전체 AI 역량 강화
    - 지속적 혁신 체계 확립
    
    ## 핵심 성공 요인
    
    ### 기술적 요인
    - 확장 가능한 AI 인프라 구축
    - 데이터 품질 관리 체계
    - MLOps 파이프라인 구축
    - 보안 및 컴플라이언스 확보
    
    ### 조직적 요인
    - 최고 경영진의 강력한 지원
    - 전담 조직 및 인력 확보
    - 변화 관리 프로그램 운영
    - 지속적 교육 및 역량 개발
    
    ### 비즈니스 요인
    - 명확한 비즈니스 케이스
    - 단계적 투자 및 성과 관리
    - 고객 가치 창출 중심 접근
    - 생태계 파트너십 구축
    
    ## 산업별 적용 사례
    
    ### 제조업
    - 예측 유지보수로 설비 가동률 15% 향상
    - 품질 검사 자동화로 불량률 30% 감소
    - 공급망 최적화로 재고 비용 20% 절감
    
    ### 금융업
    - 신용평가 모델 개선으로 대출 승인률 10% 향상
    - 사기 탐지 시스템으로 손실 50% 감소
    - 개인화 상품 추천으로 교차 판매 25% 증가
    
    ### 리테일
    - 수요 예측 정확도 향상으로 재고 회전율 20% 개선
    - 개인화 마케팅으로 고객 전환율 15% 증가
    - 챗봇 도입으로 고객 서비스 비용 40% 절감
    
    ## 결론
    
    성공적인 엔터프라이즈 AI 도입을 위해서는 기술적 우수성뿐만 아니라 
    조직 차원의 변화 관리와 지속적인 혁신 문화 구축이 필수적입니다.
    
    특히 한국 기업들은 제조업 기반의 강점을 활용하여 
    AI 기술과 전통 산업의 융합을 통한 새로운 가치 창출에 
    집중해야 할 것입니다.
  `;
  complexScrap.htmlContent = '<div>복잡한 엔터프라이즈 AI 분석 HTML 콘텐츠</div>';
  complexScrap.userComment = '우리 회사 상황에 맞는 구체적인 실행 계획과 예산 계획을 포함해서 작성해주세요.';
  complexScrap.user = user;
  
  await em.persistAndFlush(complexScrap);
  console.log(`   📊 복잡한 스크랩 생성 완료`);
  return complexScrap;
}

async function testBasicAiGeneration(
  articlesService: ArticlesService, 
  userId: number, 
  scraps: Scrap[]
): Promise<void> {
  const generateDto: GenerateArticleDto = {
    topic: 'AI 기술 동향과 비즈니스 적용 전략',
    keyInsight: 'AI 기술의 급속한 발전이 다양한 산업에 미치는 영향과 기회',
    scrapIds: scraps.map(scrap => scrap.scrapId),
    scrapComments: [
      {
        scrapId: scraps[0].scrapId,
        userComment: '기술적 세부사항보다는 비즈니스 임팩트에 집중해서 설명해주세요.'
      },
      {
        scrapId: scraps[1].scrapId,
        userComment: '시장 데이터를 활용한 전략적 인사이트를 제공해주세요.'
      }
    ],
    generationParams: '경영진 보고용으로 활용할 수 있도록 핵심 포인트를 명확히 하고, 실행 가능한 액션 아이템을 포함해주세요.'
  };

  const startTime = Date.now();
  
  try {
    const result = await articlesService.generateArticle(userId, generateDto);
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    console.log(`   ⏱️  실행 시간: ${executionTime}ms`);
    console.log(`   📝 아티클 ID: ${result.id}`);
    console.log(`   📋 주제: ${generateDto.topic}`);
    console.log(`   💡 핵심 인사이트: ${generateDto.keyInsight}`);
    console.log(`   🔗 연결된 스크랩: ${scraps.length}개`);
    
    // 생성된 콘텐츠 확인
    console.log(`   📄 생성된 제목: "${result.title}"`);
    console.log(`   📊 콘텐츠 길이: ${result.content.length}자`);
    console.log(`   📅 생성 시간: ${result.createdAt}`);
    console.log(`   📖 내용 미리보기:`);
    console.log(`      ${result.content.substring(0, 200)}...`);
    
  } catch (error) {
    console.error('   ❌ 기본 AI 생성 테스트 실패:', error.message);
    throw error;
  }
}

async function testComplexAiGeneration(
  articlesService: ArticlesService, 
  userId: number, 
  scraps: Scrap[]
): Promise<void> {
  const generateDto: GenerateArticleDto = {
    topic: '엔터프라이즈 AI 도입 전략 및 실행 방안',
    keyInsight: '성공적인 엔터프라이즈 AI 도입을 위한 체계적 접근 방법론',
    scrapIds: scraps.map(scrap => scrap.scrapId),
    scrapComments: [
      {
        scrapId: scraps[0].scrapId,
        userComment: '실제 도입 사례와 구체적인 ROI 데이터를 포함해서 작성해주세요.'
      }
    ],
    generationParams: '기술 리더와 비즈니스 의사결정자 모두가 활용할 수 있도록 기술적 깊이와 비즈니스 관점을 균형있게 다뤄주세요. 실행 로드맵과 예산 가이드라인을 포함해주세요.'
  };

  const startTime = Date.now();
  
  try {
    const result = await articlesService.generateArticle(userId, generateDto);
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    console.log(`   ⏱️  실행 시간: ${executionTime}ms`);
    console.log(`   📝 아티클 ID: ${result.id}`);
    
    console.log(`   📄 생성된 제목: "${result.title}"`);
    console.log(`   📊 콘텐츠 길이: ${result.content.length}자`);
    
    // 복잡한 콘텐츠 품질 검증
    const content = result.content.toLowerCase();
    const hasKeywords = [
      'ai', '인공지능', '도입', '전략', '실행', 'roi'
    ].some(keyword => content.includes(keyword));
    
    console.log(`   🔍 키워드 포함 여부: ${hasKeywords ? '✅' : '❌'}`);
    console.log(`   📈 구조화 품질: ${result.content.split('\n').length > 10 ? '✅' : '❌'}`);
    console.log(`   📖 내용 미리보기:`);
    console.log(`      ${result.content.substring(0, 300)}...`);
    
  } catch (error) {
    console.error('   ❌ 복잡한 AI 생성 테스트 실패:', error.message);
    throw error;
  }
}

async function testPerformance(
  articlesService: ArticlesService, 
  userId: number, 
  scraps: Scrap[]
): Promise<void> {
  const tests = [
    { name: '짧은 콘텐츠', params: '간결하고 핵심적인 내용으로 작성해주세요.' },
    { name: '중간 콘텐츠', params: '상세한 분석과 예시를 포함해서 작성해주세요.' },
    { name: '긴 콘텐츠', params: '포괄적인 분석, 다양한 사례, 실행 계획, 예산 분석을 모두 포함한 완전한 보고서로 작성해주세요.' }
  ];

  for (const test of tests) {
    console.log(`   🎯 ${test.name} 테스트 시작...`);
    
    const generateDto: GenerateArticleDto = {
      topic: `AI 기술 분석 - ${test.name}`,
      keyInsight: 'AI 기술의 비즈니스 적용 방안',
      scrapIds: scraps.map(scrap => scrap.scrapId),
      generationParams: test.params
    };

    const startTime = Date.now();
    
    try {
      const result = await articlesService.generateArticle(userId, generateDto);
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      console.log(`      ⏱️  실행 시간: ${executionTime}ms`);
      console.log(`      📊 생성된 길이: ${result.content.length}자`);
      console.log(`      📈 초당 생성량: ${Math.round(result.content.length / (executionTime / 1000))}자/초`);
      
    } catch (error) {
      console.error(`      ❌ ${test.name} 테스트 실패:`, error.message);
    }
  }
}

async function testQualityValidation(
  articlesService: ArticlesService, 
  userId: number, 
  scraps: Scrap[]
): Promise<void> {
  const topics = [
    '블록체인 기술의 미래와 적용 방안',
    '클라우드 컴퓨팅 전략 및 마이그레이션',
    '사이버보안 강화 방안과 제로 트러스트'
  ];

  for (const topic of topics) {
    console.log(`   🔍 주제별 품질 검증: ${topic}`);
    
    const generateDto: GenerateArticleDto = {
      topic: topic,
      keyInsight: '최신 기술 동향과 실무 적용 방안',
      scrapIds: scraps.map(scrap => scrap.scrapId),
      generationParams: '전문성과 실용성을 모두 갖춘 콘텐츠로 작성해주세요.'
    };

    try {
      const result = await articlesService.generateArticle(userId, generateDto);
      
      // 품질 지표 계산
      const titleRelevance = result.title.toLowerCase().includes(topic.split(' ')[0].toLowerCase());
      const contentLength = result.content.length;
      const structureQuality = result.content.split('\n').length > 5;
      const topicRelevance = result.content.toLowerCase().includes(topic.split(' ')[0].toLowerCase());
      
      console.log(`      📋 제목 관련성: ${titleRelevance ? '✅' : '❌'}`);
      console.log(`      📏 콘텐츠 길이: ${contentLength > 300 ? '✅' : '❌'} (${contentLength}자)`);
      console.log(`      🏗️  구조적 품질: ${structureQuality ? '✅' : '❌'}`);
      console.log(`      🎯 주제 관련성: ${topicRelevance ? '✅' : '❌'}`);
      
    } catch (error) {
      console.error(`      ❌ 품질 검증 실패:`, error.message);
    }
  }
}

// 스크립트 실행
if (require.main === module) {
  runProductionTest().catch(console.error);
}

export { runProductionTest }; 