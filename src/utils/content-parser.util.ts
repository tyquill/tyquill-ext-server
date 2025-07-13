/**
 * 뉴스레터 콘텐츠 파싱을 위한 유틸리티 클래스
 * 다양한 형식의 AI 생성 콘텐츠에서 제목과 본문을 추출합니다.
 */
export interface ParsedContent {
  title: string;
  content: string;
}

export class ContentParser {
  private static readonly DEFAULT_TITLE = '생성된 뉴스레터';
  private static readonly MAX_TITLE_LENGTH = 100;

  /**
   * 메인 파싱 메서드: 여러 파서를 순차적으로 시도하여 첫 번째 성공한 결과를 반환
   */
  static parseNewsletterContent(content: string): ParsedContent {
    if (!content || content.trim().length === 0) {
      return {
        title: this.DEFAULT_TITLE,
        content: '',
      };
    }

    // 1. INTEGRATED_SOLUTION 섹션에서 추출 시도
    const extractedContent = this.extractIntegratedSolution(content);
    const targetContent = extractedContent || content;

    // 2. 각 파서를 순차적으로 시도
    const parsers = [
      this.parseBoldTitle,
      this.parseHashTitle,
      this.parseFirstLineAsTitle,
    ];

    for (const parser of parsers) {
      const result = parser(targetContent);
      if (result) {
        return result;
      }
    }

    // 3. 모든 파서가 실패하면 기본값 반환
    return this.createDefaultResult(targetContent);
  }

  /**
   * INTEGRATED_SOLUTION 섹션에서 콘텐츠 추출
   */
  private static extractIntegratedSolution(content: string): string | null {
    const solutionMatch = content.match(/INTEGRATED_SOLUTION:\s*([\s\S]+)/i);
    return solutionMatch ? solutionMatch[1].trim() : null;
  }

  /**
   * **제목** 형식의 볼드 제목 파싱
   */
  private static parseBoldTitle(content: string): ParsedContent | null {
    const boldTitleMatch = content.match(/\*\*([^*]+)\*\*/);
    if (boldTitleMatch) {
      const title = boldTitleMatch[1].trim();
      if (ContentParser.isValidTitle(title)) {
        const contentWithoutTitle = content.replace(/\*\*[^*]+\*\*/, '').trim();
        return {
          title: ContentParser.cleanTitle(title),
          content: contentWithoutTitle || content,
        };
      }
    }
    return null;
  }

  /**
   * # 제목 형식의 마크다운 제목 파싱
   */
  private static parseHashTitle(content: string): ParsedContent | null {
    const hashTitleMatch = content.match(/^#\s*(.+)/m);
    if (hashTitleMatch) {
      const title = hashTitleMatch[1].trim();
      if (ContentParser.isValidTitle(title)) {
        const contentWithoutTitle = content.replace(/^#\s*.+/m, '').trim();
        return {
          title: ContentParser.cleanTitle(title),
          content: contentWithoutTitle || content,
        };
      }
    }
    return null;
  }

  /**
   * 첫 번째 줄을 제목으로 사용하는 파싱
   */
  private static parseFirstLineAsTitle(content: string): ParsedContent | null {
    const lines = content.split('\n');
    const firstLine = lines[0]?.trim();
    
    if (firstLine && ContentParser.isValidTitle(firstLine)) {
      const restContent = lines.slice(1).join('\n').trim();
      return {
        title: ContentParser.cleanTitle(firstLine),
        content: restContent || content,
      };
    }
    return null;
  }

  /**
   * 제목의 유효성 검사
   */
  private static isValidTitle(title: string): boolean {
    return title.length > 0 && title.length <= ContentParser.MAX_TITLE_LENGTH;
  }

  /**
   * 제목에서 불필요한 마크다운 문자 제거
   */
  private static cleanTitle(title: string): string {
    return title.replace(/[#*]/g, '').trim();
  }

  /**
   * 기본 결과 생성
   */
  private static createDefaultResult(content: string): ParsedContent {
    return {
      title: ContentParser.DEFAULT_TITLE,
      content: content,
    };
  }

  /**
   * 추가 파싱 유틸리티: 출력에서 신뢰도 점수 추출
   */
  static extractConfidenceScore(output: string, defaultValue: number = 80): number {
    const confidenceMatch = output.match(/(?:CONFIDENCE|신뢰도|SYNTHESIS_CONFIDENCE):\s*(-?\d+)/i);
    if (confidenceMatch) {
      const confidence = parseInt(confidenceMatch[1]);
      return Math.min(Math.max(confidence, 0), 100); // 0-100 범위로 제한
    }
    return defaultValue;
  }

  /**
   * 추가 파싱 유틸리티: 출력에서 리스트 추출
   */
  static extractListFromOutput(output: string, fieldName: string): string[] {
    const pattern = new RegExp(`${fieldName}:\\s*(.+?)(?=\\n[A-Z_]+:|$)`, 'i');
    const match = output.match(pattern);
    
    if (match && match[1]) {
      return match[1]
        .split(/[|,]/)
        .map(item => item.trim())
        .filter(item => item.length > 0 && item !== 'NONE' && item !== '없음');
    }
    
    return [];
  }

  /**
   * 추가 파싱 유틸리티: 키-값 쌍 추출
   */
  static extractKeyValue(output: string, key: string): string | null {
    const pattern = new RegExp(`${key}:\\s*(.+?)(?=\\n|$)`, 'i');
    const match = output.match(pattern);
    return match ? match[1].trim() : null;
  }
} 