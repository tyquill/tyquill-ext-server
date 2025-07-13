import { ContentParser, ParsedContent } from './content-parser.util';

describe('ContentParser', () => {
  describe('parseNewsletterContent', () => {
    it('빈 콘텐츠에 대해 기본값을 반환해야 함', () => {
      const result = ContentParser.parseNewsletterContent('');
      expect(result).toEqual({
        title: '생성된 뉴스레터',
        content: '',
      });
    });

    it('INTEGRATED_SOLUTION 섹션에서 콘텐츠를 추출해야 함', () => {
      const content = `
CONSENSUS_ELEMENTS: [agreed_elements]
RESOLVED_CONFLICTS: [resolution_decisions]
INTEGRATED_SOLUTION: **AI 뉴스레터 제목**

이것은 AI가 생성한 뉴스레터 본문입니다.
SYNTHESIS_CONFIDENCE: 95
`;
      const result = ContentParser.parseNewsletterContent(content);
      expect(result.title).toBe('AI 뉴스레터 제목');
      expect(result.content).toContain('이것은 AI가 생성한 뉴스레터 본문입니다.');
    });

    it('볼드 제목 형식(**제목**)을 파싱해야 함', () => {
      const content = '**혁신적인 AI 기술 동향**\n\n이것은 본문 내용입니다.';
      const result = ContentParser.parseNewsletterContent(content);
      expect(result.title).toBe('혁신적인 AI 기술 동향');
      expect(result.content).toBe('이것은 본문 내용입니다.');
    });

    it('마크다운 제목 형식(# 제목)을 파싱해야 함', () => {
      const content = '# 주간 기술 뉴스\n\n최신 기술 동향을 소개합니다.';
      const result = ContentParser.parseNewsletterContent(content);
      expect(result.title).toBe('주간 기술 뉴스');
      expect(result.content).toBe('최신 기술 동향을 소개합니다.');
    });

    it('첫 번째 줄을 제목으로 사용해야 함', () => {
      const content = '스타트업 성공 비결\n\n실리콘밸리 경험담을 공유합니다.\n\n더 많은 내용...';
      const result = ContentParser.parseNewsletterContent(content);
      expect(result.title).toBe('스타트업 성공 비결');
      expect(result.content).toBe('실리콘밸리 경험담을 공유합니다.\n\n더 많은 내용...');
    });

    it('첫 번째 줄이 너무 길면 기본 제목을 사용해야 함', () => {
      const veryLongTitle = 'a'.repeat(150); // 100자를 초과하는 제목
      const content = `${veryLongTitle}\n\n본문 내용입니다.`;
      const result = ContentParser.parseNewsletterContent(content);
      expect(result.title).toBe('생성된 뉴스레터');
      expect(result.content).toBe(content);
    });

    it('제목에서 마크다운 문자를 제거해야 함', () => {
      const content = '### **AI 혁명** ###\n\n인공지능의 미래를 살펴봅시다.';
      const result = ContentParser.parseNewsletterContent(content);
      expect(result.title).toBe('AI 혁명');
    });

    it('복합 형식에서 우선순위에 따라 파싱해야 함', () => {
      const content = `
INTEGRATED_SOLUTION: # 마크다운 제목

**볼드 제목**

첫 번째 줄 제목
본문 내용입니다.
`;
      const result = ContentParser.parseNewsletterContent(content);
      // 볼드 제목이 마크다운 제목보다 우선순위가 높음
      expect(result.title).toBe('볼드 제목');
    });
  });

  describe('extractConfidenceScore', () => {
    it('CONFIDENCE 패턴에서 신뢰도를 추출해야 함', () => {
      const output = 'CONFIDENCE: 85\nOther content';
      const result = ContentParser.extractConfidenceScore(output);
      expect(result).toBe(85);
    });

    it('신뢰도 패턴에서 신뢰도를 추출해야 함', () => {
      const output = '신뢰도: 92\n기타 내용';
      const result = ContentParser.extractConfidenceScore(output);
      expect(result).toBe(92);
    });

    it('SYNTHESIS_CONFIDENCE 패턴에서 신뢰도를 추출해야 함', () => {
      const output = 'SYNTHESIS_CONFIDENCE: 78';
      const result = ContentParser.extractConfidenceScore(output);
      expect(result).toBe(78);
    });

    it('범위를 벗어난 값을 제한해야 함', () => {
      const highOutput = 'CONFIDENCE: 150';
      const lowOutput = 'CONFIDENCE: -10';
      
      expect(ContentParser.extractConfidenceScore(highOutput)).toBe(100);
      expect(ContentParser.extractConfidenceScore(lowOutput)).toBe(0);
    });

    it('신뢰도를 찾을 수 없으면 기본값을 반환해야 함', () => {
      const output = 'No confidence score here';
      const result = ContentParser.extractConfidenceScore(output, 75);
      expect(result).toBe(75);
    });
  });

  describe('extractListFromOutput', () => {
    it('파이프로 구분된 리스트를 추출해야 함', () => {
      const output = 'STRENGTHS: 강점1 | 강점2 | 강점3\nWEAKNESSES: 약점들';
      const result = ContentParser.extractListFromOutput(output, 'STRENGTHS');
      expect(result).toEqual(['강점1', '강점2', '강점3']);
    });

    it('쉼표로 구분된 리스트를 추출해야 함', () => {
      const output = 'IMPROVEMENTS: 개선1, 개선2, 개선3';
      const result = ContentParser.extractListFromOutput(output, 'IMPROVEMENTS');
      expect(result).toEqual(['개선1', '개선2', '개선3']);
    });

    it('NONE과 없음을 필터링해야 함', () => {
      const output = 'ISSUES: NONE | 없음 | 실제이슈';
      const result = ContentParser.extractListFromOutput(output, 'ISSUES');
      expect(result).toEqual(['실제이슈']);
    });

    it('필드를 찾을 수 없으면 빈 배열을 반환해야 함', () => {
      const output = 'OTHER_FIELD: 값들';
      const result = ContentParser.extractListFromOutput(output, 'MISSING_FIELD');
      expect(result).toEqual([]);
    });
  });

  describe('extractKeyValue', () => {
    it('키-값 쌍을 추출해야 함', () => {
      const output = 'TYPE: informational\nCONFIDENCE: 85';
      const result = ContentParser.extractKeyValue(output, 'TYPE');
      expect(result).toBe('informational');
    });

    it('키를 찾을 수 없으면 null을 반환해야 함', () => {
      const output = 'OTHER_KEY: value';
      const result = ContentParser.extractKeyValue(output, 'MISSING_KEY');
      expect(result).toBe(null);
    });

    it('줄 끝까지의 값을 추출해야 함', () => {
      const output = 'REASON: 이것은 긴 설명입니다\nNEXT_LINE: 다음';
      const result = ContentParser.extractKeyValue(output, 'REASON');
      expect(result).toBe('이것은 긴 설명입니다');
    });
  });
}); 