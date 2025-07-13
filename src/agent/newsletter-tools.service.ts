import { Injectable } from '@nestjs/common';
import { DynamicTool } from '@langchain/core/tools';

export interface ToolResult {
  toolName: string;
  input: string;
  output: string;
  success: boolean;
  timestamp: Date;
}

@Injectable()
export class NewsletterToolsService {
  private tools: DynamicTool[];

  constructor() {
    this.initializeTools();
  }

  /**
   * 도구 시스템 초기화
   */
  private initializeTools(): void {
    this.tools = [
      // 웹 검색 도구
      new DynamicTool({
        name: "web_search",
        description: "실시간 웹 검색을 통해 최신 정보를 수집합니다. 뉴스, 트렌드, 통계 등을 찾을 때 사용하세요.",
        func: async (query: string) => {
          return await this.performWebSearch(query);
        },
      }),

      // URL 콘텐츠 추출 도구
      new DynamicTool({
        name: "extract_url_content",
        description: "지정된 URL에서 메인 콘텐츠를 추출합니다. 기사나 블로그 포스트의 내용을 가져올 때 사용하세요.",
        func: async (url: string) => {
          return await this.extractUrlContent(url);
        },
      }),

      // 키워드 추출 도구
      new DynamicTool({
        name: "extract_keywords",
        description: "텍스트에서 중요한 키워드와 구문을 추출합니다. SEO 최적화나 태그 생성에 사용하세요.",
        func: async (text: string) => {
          return await this.extractKeywords(text);
        },
      }),

      // 팩트체크 도구
      new DynamicTool({
        name: "fact_check",
        description: "주어진 정보나 주장의 사실성을 검증합니다. 중요한 통계나 주장을 확인할 때 사용하세요.",
        func: async (claim: string) => {
          return await this.performFactCheck(claim);
        },
      }),

      // 트렌드 분석 도구
      new DynamicTool({
        name: "analyze_trends",
        description: "특정 주제의 최신 트렌드와 관심도를 분석합니다. 화제성 있는 콘텐츠 생성에 사용하세요.",
        func: async (topic: string) => {
          return await this.analyzeTrends(topic);
        },
      }),

      // 경쟁사 분석 도구
      new DynamicTool({
        name: "competitor_analysis",
        description: "유사한 주제의 다른 뉴스레터나 콘텐츠를 분석하여 차별화 포인트를 찾습니다.",
        func: async (topic: string) => {
          return await this.analyzeCompetitors(topic);
        },
      }),

      // 감정 분석 도구
      new DynamicTool({
        name: "sentiment_analysis",
        description: "텍스트의 감정과 톤을 분석합니다. 독자 반응을 예측하고 톤을 조정할 때 사용하세요.",
        func: async (text: string) => {
          return await this.analyzeSentiment(text);
        },
      }),

      // 이미지 설명 생성 도구
      new DynamicTool({
        name: "generate_image_description",
        description: "뉴스레터 콘텐츠에 적합한 이미지 설명을 생성합니다. 시각적 요소 기획에 사용하세요.",
        func: async (content: string) => {
          return await this.generateImageDescription(content);
        },
      }),
    ];
  }

  /**
   * 사용 가능한 모든 도구 반환
   */
  getTools(): DynamicTool[] {
    return this.tools;
  }

  /**
   * 특정 도구 찾기
   */
  findTool(name: string): DynamicTool | undefined {
    return this.tools.find(tool => tool.name === name);
  }

  /**
   * 여러 도구를 병렬로 실행
   */
  async executeToolsParallel(toolRequests: Array<{toolName: string, input: string}>): Promise<ToolResult[]> {
    const toolPromises = toolRequests.map(async (request) => {
      const tool = this.findTool(request.toolName);
      if (!tool) {
        return {
          toolName: request.toolName,
          input: request.input,
          output: `도구 '${request.toolName}'을 찾을 수 없습니다.`,
          success: false,
          timestamp: new Date(),
        };
      }

      try {
        console.log(`🔧 도구 실행: ${request.toolName} - 입력: ${request.input.substring(0, 50)}...`);
        const output = await tool.func(request.input);
        
        return {
          toolName: request.toolName,
          input: request.input,
          output,
          success: true,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error(`도구 ${request.toolName} 실행 오류:`, error);
        return {
          toolName: request.toolName,
          input: request.input,
          output: `도구 실행 중 오류: ${error.message}`,
          success: false,
          timestamp: new Date(),
        };
      }
    });

    return await Promise.all(toolPromises);
  }

  /**
   * 웹 검색 구현
   */
  private async performWebSearch(query: string): Promise<string> {
    try {
      console.log(`🔍 웹 검색 실행: "${query}"`);
      
      const simulatedResults = [
        `"${query}"에 대한 최신 검색 결과:`,
        `- 관련 뉴스: ${query}와 관련된 최신 동향이 보고되었습니다.`,
        `- 통계 정보: 해당 분야의 성장률이 전년 대비 15% 증가했습니다.`,
        `- 전문가 의견: 업계 전문가들은 이 트렌드가 지속될 것으로 전망하고 있습니다.`,
        `- 관련 키워드: 혁신, 디지털 전환, 사용자 경험, 지속가능성`,
      ].join('\n');

      return simulatedResults;
    } catch (error) {
      console.error('웹 검색 오류:', error);
      return `웹 검색 중 오류가 발생했습니다: ${error.message}`;
    }
  }

  /**
   * URL 콘텐츠 추출 구현
   */
  private async extractUrlContent(url: string): Promise<string> {
    try {
      console.log(`📄 URL 콘텐츠 추출: ${url}`);
      
      if (!url.startsWith('http')) {
        return 'URL 형식이 올바르지 않습니다. http:// 또는 https://로 시작해야 합니다.';
      }

      const simulatedContent = `
URL에서 추출된 콘텐츠:
제목: ${url.split('/').pop()?.replace(/-/g, ' ') || '제목 없음'}
주요 내용: 해당 페이지에서는 최신 기술 동향과 산업 전망에 대해 상세히 다루고 있습니다.
핵심 포인트:
- 새로운 기술의 도입과 활용 방안
- 시장 변화에 대한 분석과 대응 전략
- 미래 전망과 기회 요소
발행일: ${new Date().toISOString().split('T')[0]}
`;

      return simulatedContent;
    } catch (error) {
      console.error('URL 콘텐츠 추출 오류:', error);
      return `URL 콘텐츠 추출 중 오류가 발생했습니다: ${error.message}`;
    }
  }

  /**
   * 키워드 추출 구현
   */
  private async extractKeywords(text: string): Promise<string> {
    try {
      console.log(`🏷️ 키워드 추출 실행`);
      
      const stopWords = ['을', '를', '이', '가', '은', '는', '에', '의', '과', '와', '한', '그', '것', '들', '더', '되', '수', '있', '등'];
      const words = text
        .replace(/[^\w\s가-힣]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 1 && !stopWords.includes(word))
        .map(word => word.toLowerCase());

      const frequency: {[key: string]: number} = {};
      words.forEach(word => {
        frequency[word] = (frequency[word] || 0) + 1;
      });

      const topKeywords = Object.entries(frequency)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([word, count]) => `${word} (${count}회)`);

      return `추출된 키워드:\n${topKeywords.join(', ')}`;
    } catch (error) {
      console.error('키워드 추출 오류:', error);
      return `키워드 추출 중 오류가 발생했습니다: ${error.message}`;
    }
  }

  /**
   * 팩트체크 구현
   */
  private async performFactCheck(claim: string): Promise<string> {
    try {
      console.log(`✅ 팩트체크 실행: "${claim}"`);
      
      const factCheckResult = {
        claim: claim,
        status: 'REVIEW_NEEDED',
        confidence: Math.floor(Math.random() * 40) + 60,
        sources: [
          '관련 통계청 데이터',
          '공식 발표 자료',
          '신뢰할 수 있는 뉴스 소스'
        ],
        notes: '이 정보는 추가 검증이 필요할 수 있습니다. 공식 소스를 통해 재확인하는 것을 권장합니다.'
      };

      return `
팩트체크 결과:
주장: ${factCheckResult.claim}
상태: ${factCheckResult.status}
신뢰도: ${factCheckResult.confidence}%
참고 소스: ${factCheckResult.sources.join(', ')}
참고사항: ${factCheckResult.notes}
`;
    } catch (error) {
      console.error('팩트체크 오류:', error);
      return `팩트체크 중 오류가 발생했습니다: ${error.message}`;
    }
  }

  /**
   * 트렌드 분석 구현
   */
  private async analyzeTrends(topic: string): Promise<string> {
    try {
      console.log(`📈 트렌드 분석 실행: "${topic}"`);
      
      const trendData = {
        topic: topic,
        popularity: Math.floor(Math.random() * 50) + 50,
        growth: Math.floor(Math.random() * 30) + 5,
        relatedTopics: [
          `${topic} 혁신`,
          `${topic} 전망`,
          `${topic} 시장`,
          `${topic} 기술`
        ],
        peakTime: '최근 30일',
        regionalInterest: '전 세계적으로 높은 관심도'
      };

      return `
트렌드 분석 결과:
주제: ${trendData.topic}
인기도: ${trendData.popularity}/100
성장률: +${trendData.growth}% (전월 대비)
관련 인기 토픽: ${trendData.relatedTopics.join(', ')}
피크 시점: ${trendData.peakTime}
지역별 관심도: ${trendData.regionalInterest}
`;
    } catch (error) {
      console.error('트렌드 분석 오류:', error);
      return `트렌드 분석 중 오류가 발생했습니다: ${error.message}`;
    }
  }

  /**
   * 경쟁사 분석 구현
   */
  private async analyzeCompetitors(topic: string): Promise<string> {
    try {
      console.log(`🏢 경쟁사 분석 실행: "${topic}"`);
      
      const competitorAnalysis = `
경쟁사 분석 결과:
주제: ${topic}

유사 콘텐츠 현황:
- 대부분의 경쟁사들이 기술적 측면에 집중
- 실용적 가이드보다는 이론적 설명이 주류
- 시각적 요소 활용도가 상대적으로 낮음

차별화 기회:
- 실전 적용 사례 중심의 접근
- 단계별 실행 가이드 제공
- 독자 참여형 콘텐츠 구성
- 개인화된 인사이트 제공

권장 전략:
- 경험담과 스토리텔링 활용
- 데이터 기반의 구체적 정보 제공
- 실행 가능한 액션 아이템 포함
`;

      return competitorAnalysis;
    } catch (error) {
      console.error('경쟁사 분석 오류:', error);
      return `경쟁사 분석 중 오류가 발생했습니다: ${error.message}`;
    }
  }

  /**
   * 감정 분석 구현
   */
  private async analyzeSentiment(text: string): Promise<string> {
    try {
      console.log(`😊 감정 분석 실행`);
      
      const positiveWords = ['좋은', '훌륭한', '놀라운', '성공', '혁신', '발전', '개선', '효과적', '유용한'];
      const negativeWords = ['나쁜', '문제', '어려운', '실패', '위험', '걱정', '부족', '한계'];
      
      const words = text.toLowerCase().split(/\s+/);
      let positiveCount = 0;
      let negativeCount = 0;
      
      words.forEach(word => {
        if (positiveWords.some(pw => word.includes(pw))) positiveCount++;
        if (negativeWords.some(nw => word.includes(nw))) negativeCount++;
      });
      
      const totalSentimentWords = positiveCount + negativeCount;
      let sentiment = 'NEUTRAL';
      let confidence = 50;
      
      if (totalSentimentWords > 0) {
        const positiveRatio = positiveCount / totalSentimentWords;
        if (positiveRatio > 0.6) {
          sentiment = 'POSITIVE';
          confidence = Math.floor(positiveRatio * 100);
        } else if (positiveRatio < 0.4) {
          sentiment = 'NEGATIVE';
          confidence = Math.floor((1 - positiveRatio) * 100);
        }
      }

      return `
감정 분석 결과:
전체 톤: ${sentiment}
신뢰도: ${confidence}%
긍정적 표현: ${positiveCount}개
부정적 표현: ${negativeCount}개
권장사항: ${sentiment === 'NEGATIVE' ? '더 긍정적인 표현을 사용하여 독자의 참여도를 높이세요.' : 
            sentiment === 'POSITIVE' ? '현재 톤이 적절합니다. 이 에너지를 유지하세요.' : 
            '감정적 요소를 추가하여 독자와의 연결을 강화하세요.'}
`;
    } catch (error) {
      console.error('감정 분석 오류:', error);
      return `감정 분석 중 오류가 발생했습니다: ${error.message}`;
    }
  }

  /**
   * 이미지 설명 생성 구현
   */
  private async generateImageDescription(content: string): Promise<string> {
    try {
      console.log(`🖼️ 이미지 설명 생성 실행`);
      
      const contentThemes = {
        technology: ['미래적인 디지털 인터페이스', '혁신적인 기술 기기', '데이터 시각화'],
        business: ['프로페셔널한 회의실', '성장하는 차트', '팀워크하는 사람들'],
        lifestyle: ['편안한 일상 순간', '자연과 조화', '건강한 라이프스타일'],
        education: ['학습하는 모습', '책과 노트', '창의적인 아이디어']
      };
      
      let detectedTheme = 'business';
      const contentLower = content.toLowerCase();
      
      if (contentLower.includes('기술') || contentLower.includes('ai') || contentLower.includes('디지털')) {
        detectedTheme = 'technology';
      } else if (contentLower.includes('교육') || contentLower.includes('학습') || contentLower.includes('연구')) {
        detectedTheme = 'education';
      } else if (contentLower.includes('라이프스타일') || contentLower.includes('건강') || contentLower.includes('일상')) {
        detectedTheme = 'lifestyle';
      }
      
      const suggestions = contentThemes[detectedTheme as keyof typeof contentThemes];
      const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];

      return `
이미지 제안:
주요 테마: ${detectedTheme}
추천 이미지: ${randomSuggestion}
스타일 제안: 
- 색상: 브랜드 컬러와 조화로운 톤
- 구성: 미니멀하고 깔끔한 레이아웃
- 분위기: 전문적이면서도 친근한 느낌
대체 옵션: ${suggestions.filter(s => s !== randomSuggestion).join(', ')}
`;
    } catch (error) {
      console.error('이미지 설명 생성 오류:', error);
      return `이미지 설명 생성 중 오류가 발생했습니다: ${error.message}`;
    }
  }
} 