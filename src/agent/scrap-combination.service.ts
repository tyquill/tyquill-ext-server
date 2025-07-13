import { Injectable } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { Scrap } from '../scraps/entities/scrap.entity';
import dotenv from 'dotenv';

export interface ScrapWithComment {
  scrap: Scrap;
  userComment?: string;
}

export interface CombinedScrapData {
  mainContent: string;
  sources: ScrapSource[];
  keyPoints: string[];
  userComments: string[];
}

export interface ScrapSource {
  title: string;
  url: string;
  summary: string;
  userComment?: string;
}

@Injectable()
export class ScrapCombinationService {
  private readonly model: ChatGoogleGenerativeAI;
  private readonly htmlAnalysisTemplate: PromptTemplate;
  private readonly contentSummaryTemplate: PromptTemplate;
  private readonly keyPointsTemplate: PromptTemplate;

  constructor() {
    console.log(`process.env.GOOGLE_API_KEY: ${process.env.GOOGLE_API_KEY}`);
    this.model = new ChatGoogleGenerativeAI({
      model: 'gemini-1.5-flash',
      temperature: 0.3,
      apiKey: process.env.GOOGLE_API_KEY,
    });

    // HTML 분석용 프롬프트
    this.htmlAnalysisTemplate = PromptTemplate.fromTemplate(`
당신은 웹 콘텐츠 분석 전문가입니다. 주어진 HTML 콘텐츠를 분석하여 구조화된 정보를 추출해주세요.

HTML 콘텐츠:
{htmlContent}

다음 형식으로 응답해주세요:
TITLE_STRUCTURE: [제목 계층 구조]
META_INFO: [메타 정보 (작성자, 날짜, 키워드 등)]
KEY_ELEMENTS: [주요 요소들 (리스트, 테이블, 강조 텍스트 등)]
EXTERNAL_LINKS: [중요한 외부 링크들]
CONTENT_TYPE: [콘텐츠 유형 (뉴스, 블로그, 학술논문, 기술문서 등)]

분석 지침:
1. HTML 태그 구조를 파악하여 의미있는 정보만 추출
2. 광고나 네비게이션 같은 불필요한 요소는 제외
3. 본문 내용과 관련된 구조화된 정보에 집중
4. 각 항목당 최대 3-5개의 핵심 정보만 선별
`);

    // 콘텐츠 요약용 프롬프트
    this.contentSummaryTemplate = PromptTemplate.fromTemplate(`
다음 텍스트를 간결하고 핵심적인 내용으로 요약해주세요.

원문:
{content}

요약 지침:
1. 2-3문장으로 핵심 내용 요약
2. 주요 키워드와 개념 포함
3. 객관적이고 정확한 정보 전달
4. 불필요한 부사나 형용사 제거
`);

    // 핵심 포인트 추출용 프롬프트
    this.keyPointsTemplate = PromptTemplate.fromTemplate(`
다음 스크랩 데이터들을 분석하여 핵심 포인트를 추출해주세요.

스크랩 데이터:
{scrapData}

사용자 코멘트:
{userComments}

다음 형식으로 응답해주세요:
KEY_POINTS: [핵심 포인트 1] | [핵심 포인트 2] | [핵심 포인트 3]

추출 지침:
1. 사용자 코멘트를 우선적으로 반영
2. 각 스크랩의 핵심 메시지 파악
3. 중복되는 내용은 통합
4. 최대 5개의 핵심 포인트만 선별
5. 각 포인트는 명확하고 구체적으로 작성
`);
  }
  
  /**
   * 선택된 스크랩들을 구조화하여 조합합니다
   */
  combineScrapData(scraps: Scrap[]): CombinedScrapData {
    if (scraps.length === 0) {
      return {
        mainContent: '',
        sources: [],
        keyPoints: [],
        userComments: [],
      };
    }

    const sources = this.createScrapSources(scraps);
    const keyPoints = this.extractKeyPoints(scraps);
    const userComments = this.collectUserComments(scraps);
    const mainContent = this.createMainContent(scraps, keyPoints);

    return {
      mainContent,
      sources,
      keyPoints,
      userComments,
    };
  }

  /**
   * 스크랩들을 소스 정보로 변환합니다
   */
  private createScrapSources(scraps: Scrap[]): ScrapSource[] {
    return scraps.map(scrap => ({
      title: scrap.title,
      url: scrap.url,
      summary: this.createSummary(scrap.content),
      userComment: scrap.userComment,
    }));
  }

  /**
   * 콘텐츠 요약을 생성합니다
   */
  private createSummary(content: string): string {
    // 간단한 요약 로직 - 첫 200자 또는 첫 두 문장
    const sentences = content.split(/[.!?]/);
    if (sentences.length >= 2) {
      return sentences.slice(0, 2).join('. ').trim() + '.';
    }
    return content.length > 200 ? content.substring(0, 200) + '...' : content;
  }

  /**
   * 스크랩들에서 핵심 포인트를 추출합니다
   */
  private extractKeyPoints(scraps: Scrap[]): string[] {
    const keyPoints: string[] = [];
    
    scraps.forEach(scrap => {
      // 사용자 코멘트가 있으면 우선적으로 핵심 포인트로 사용
      if (scrap.userComment && scrap.userComment.trim()) {
        keyPoints.push(`[${scrap.title}] ${scrap.userComment}`);
      }
      
      // 콘텐츠에서 핵심 문장 추출 (간단한 휴리스틱)
      const importantSentences = this.findImportantSentences(scrap.content);
      importantSentences.forEach(sentence => {
        keyPoints.push(`[${scrap.title}] ${sentence}`);
      });
    });

    return keyPoints;
  }

  /**
   * AI를 활용하여 콘텐츠를 요약합니다
   */
  private async createAiSummary(content: string): Promise<string> {
    try {
      // 콘텐츠가 너무 짧으면 그대로 반환
      if (content.length < 100) {
        return content;
      }

      // 콘텐츠 길이 제한 (토큰 제한 고려)
      const maxLength = 3000;
      const truncatedContent = content.length > maxLength 
        ? content.substring(0, maxLength) + '...'
        : content;

      const chain = this.contentSummaryTemplate.pipe(this.model).pipe(new StringOutputParser());
      
      const summary = await chain.invoke({
        content: truncatedContent,
      });

      return summary.trim() || this.createSummary(content);
    } catch (error) {
      console.error('AI 요약 오류:', error);
      // 실패 시 기존 방식으로 폴백
      return this.createSummary(content);
    }
  }

  /**
   * AI를 활용하여 핵심 포인트를 추출합니다
   */
  private async extractAiKeyPoints(scrapsWithComments: ScrapWithComment[]): Promise<string[]> {
    try {
      // 스크랩 데이터 구성
      const scrapData = scrapsWithComments.map((item, index) => {
        const { scrap, userComment } = item;
        return `${index + 1}. ${scrap.title}\n   내용: ${this.createSummary(scrap.content)}\n   URL: ${scrap.url}`;
      }).join('\n\n');

      // 사용자 코멘트 구성
      const userComments = scrapsWithComments
        .map((item, index) => {
          const comment = item.userComment || item.scrap.userComment;
          return comment ? `${index + 1}. ${comment}` : null;
        })
        .filter(Boolean)
        .join('\n');

      const chain = this.keyPointsTemplate.pipe(this.model).pipe(new StringOutputParser());
      
      const result = await chain.invoke({
        scrapData,
        userComments: userComments || '사용자 코멘트 없음',
      });

      return this.parseKeyPointsResult(result);
    } catch (error) {
      console.error('AI 핵심 포인트 추출 오류:', error);
      // 실패 시 기존 방식으로 폴백
      return this.extractKeyPointsFromComments(scrapsWithComments);
    }
  }

  /**
   * AI 핵심 포인트 추출 결과를 파싱합니다
   */
  private parseKeyPointsResult(result: string): string[] {
    const keyPointsMatch = result.match(/KEY_POINTS:\s*(.+)/i);
    if (keyPointsMatch && keyPointsMatch[1].trim()) {
      return keyPointsMatch[1]
        .split('|')
        .map(point => point.trim())
        .filter(point => point.length > 0)
        .slice(0, 5); // 최대 5개
    }
    return [];
  }

  /**
   * 콘텐츠에서 중요한 문장들을 찾습니다
   */
  private findImportantSentences(content: string): string[] {
    const sentences = content.split(/[.!?]/).map(s => s.trim()).filter(s => s.length > 0);
    const importantSentences: string[] = [];
    
    // 키워드 기반 중요 문장 선별
    const importantKeywords = [
      '중요', '핵심', '주요', '결론', '요약', '포인트', '특징', '장점', '단점',
      '결과', '영향', '변화', '트렌드', '전망', '예상', '분석', '평가'
    ];
    
    sentences.forEach(sentence => {
      if (sentence.length > 20 && sentence.length < 150) {
        const hasImportantKeyword = importantKeywords.some(keyword => 
          sentence.includes(keyword)
        );
        if (hasImportantKeyword) {
          importantSentences.push(sentence);
        }
      }
    });

    // 최대 2개까지만 반환
    return importantSentences.slice(0, 2);
  }

  /**
   * 사용자 코멘트들을 수집합니다
   */
  private collectUserComments(scraps: Scrap[]): string[] {
    return scraps
      .filter(scrap => scrap.userComment && scrap.userComment.trim())
      .map(scrap => scrap.userComment!.trim());
  }

  /**
   * 메인 콘텐츠를 생성합니다
   */
  private createMainContent(scraps: Scrap[], keyPoints: string[]): string {
    let mainContent = '';
    
    // 개요 섹션
    mainContent += '## 주요 내용\n\n';
    
    // 각 스크랩의 핵심 내용
    scraps.forEach((scrap, index) => {
      mainContent += `### ${index + 1}. ${scrap.title}\n`;
      mainContent += `**출처**: ${scrap.url}\n\n`;
      
      if (scrap.userComment) {
        mainContent += `**개인 의견**: ${scrap.userComment}\n\n`;
      }
      
      mainContent += `${this.createSummary(scrap.content)}\n\n`;
    });
    
    // 핵심 포인트 섹션
    if (keyPoints.length > 0) {
      mainContent += '## 핵심 포인트\n\n';
      keyPoints.forEach(point => {
        mainContent += `- ${point}\n`;
      });
      mainContent += '\n';
    }
    
    return mainContent;
  }

  /**
   * 스크랩 데이터를 AI 프롬프트용 텍스트로 변환합니다
   */
  formatForAiPrompt(scraps: Scrap[]): string {
    const combinedData = this.combineScrapData(scraps);
    
    let promptText = '';
    
    // 소스 정보
    promptText += '참고 자료:\n';
    combinedData.sources.forEach((source, index) => {
      promptText += `${index + 1}. ${source.title}\n`;
      promptText += `   URL: ${source.url}\n`;
      promptText += `   내용: ${source.summary}\n`;
      if (source.userComment) {
        promptText += `   사용자 의견: ${source.userComment}\n`;
      }
      promptText += '\n';
    });
    
    // 핵심 포인트
    if (combinedData.keyPoints.length > 0) {
      promptText += '핵심 포인트:\n';
      combinedData.keyPoints.forEach(point => {
        promptText += `- ${point}\n`;
      });
      promptText += '\n';
    }
    
    return promptText;
  }

  /**
   * 아티클 생성 시점의 사용자 코멘트와 함께 스크랩 데이터를 AI 프롬프트용 텍스트로 변환합니다
   */
  async formatForAiPromptWithComments(scrapsWithComments: ScrapWithComment[]): Promise<string> {
    let promptText = '';
    
    // 소스 정보
    promptText += '참고 자료:\n';
    
    // 각 스크랩에 대해 AI 기반 분석 수행
    for (let i = 0; i < scrapsWithComments.length; i++) {
      const { scrap, userComment } = scrapsWithComments[i];
      promptText += `${i + 1}. ${scrap.title}\n`;
      promptText += `   URL: ${scrap.url}\n`;
      
      // AI 기반 콘텐츠 요약
      const aiSummary = await this.createAiSummary(scrap.content);
      promptText += `   AI 요약: ${aiSummary}\n`;
      
      // HTML 내용이 있으면 AI 기반 구조화된 정보 추출
      if (scrap.htmlContent) {
        const structuredInfo = await this.extractStructuredInfo(scrap.htmlContent);
        if (structuredInfo) {
          promptText += `   구조화된 정보: ${structuredInfo}\n`;
        }
      }
      
      // 아티클 생성 시점의 사용자 코멘트 우선 사용
      if (userComment) {
        promptText += `   사용자 의견: ${userComment}\n`;
      } else if (scrap.userComment) {
        promptText += `   기존 메모: ${scrap.userComment}\n`;
      }
      promptText += '\n';
    }
    
    // AI 기반 핵심 포인트 추출
    const aiKeyPoints = await this.extractAiKeyPoints(scrapsWithComments);
    if (aiKeyPoints.length > 0) {
      promptText += '핵심 포인트:\n';
      aiKeyPoints.forEach(point => {
        promptText += `- ${point}\n`;
      });
      promptText += '\n';
    }
    
    return promptText;
  }

  /**
   * 사용자 코멘트에서 핵심 포인트를 추출합니다
   */
  private extractKeyPointsFromComments(scrapsWithComments: ScrapWithComment[]): string[] {
    const keyPoints: string[] = [];
    
    scrapsWithComments.forEach(item => {
      const { scrap, userComment } = item;
      const commentToUse = userComment || scrap.userComment;
      
      if (commentToUse && commentToUse.trim()) {
        keyPoints.push(`[${scrap.title}] ${commentToUse}`);
      }
      
      // 콘텐츠에서도 핵심 문장 추출
      const importantSentences = this.findImportantSentences(scrap.content);
      importantSentences.forEach(sentence => {
        keyPoints.push(`[${scrap.title}] ${sentence}`);
      });
    });

    return keyPoints;
  }

  /**
   * AI를 활용하여 HTML 내용에서 구조화된 정보를 추출합니다
   */
  private async extractStructuredInfo(htmlContent: string): Promise<string | null> {
    try {
      // HTML이 너무 길면 핵심 부분만 추출
      const cleanedHtml = this.cleanHtmlForAnalysis(htmlContent);
      
      const chain = this.htmlAnalysisTemplate.pipe(this.model).pipe(new StringOutputParser());
      
      const result = await chain.invoke({
        htmlContent: cleanedHtml,
      });

      return this.parseHtmlAnalysisResult(result);
    } catch (error) {
      console.error('AI HTML 분석 오류:', error);
      // 실패 시 기존 방식으로 폴백
      return this.extractStructuredInfoFallback(htmlContent);
    }
  }

  /**
   * HTML을 분석하기 위해 정리합니다
   */
  private cleanHtmlForAnalysis(htmlContent: string): string {
    // HTML 길이 제한 (토큰 제한 고려)
    const maxLength = 8000;
    
    // 불필요한 태그 제거
    let cleaned = htmlContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    // 길이 제한
    if (cleaned.length > maxLength) {
      // body 태그 내용만 추출
      const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) {
        cleaned = bodyMatch[1].substring(0, maxLength);
      } else {
        cleaned = cleaned.substring(0, maxLength);
      }
    }

    return cleaned;
  }

  /**
   * AI 분석 결과를 파싱합니다
   */
  private parseHtmlAnalysisResult(result: string): string | null {
    const info: string[] = [];
    
    const titleMatch = result.match(/TITLE_STRUCTURE:\s*(.+)/i);
    if (titleMatch && titleMatch[1].trim()) {
      info.push(`제목 구조: ${titleMatch[1].trim()}`);
    }

    const metaMatch = result.match(/META_INFO:\s*(.+)/i);
    if (metaMatch && metaMatch[1].trim()) {
      info.push(`메타 정보: ${metaMatch[1].trim()}`);
    }

    const elementsMatch = result.match(/KEY_ELEMENTS:\s*(.+)/i);
    if (elementsMatch && elementsMatch[1].trim()) {
      info.push(`주요 요소: ${elementsMatch[1].trim()}`);
    }

    const linksMatch = result.match(/EXTERNAL_LINKS:\s*(.+)/i);
    if (linksMatch && linksMatch[1].trim()) {
      info.push(`관련 링크: ${linksMatch[1].trim()}`);
    }

    const typeMatch = result.match(/CONTENT_TYPE:\s*(.+)/i);
    if (typeMatch && typeMatch[1].trim()) {
      info.push(`콘텐츠 유형: ${typeMatch[1].trim()}`);
    }

    return info.length > 0 ? info.join(' | ') : null;
  }

  /**
   * AI 분석 실패 시 기존 방식으로 폴백
   */
  private extractStructuredInfoFallback(htmlContent: string): string | null {
    try {
      const info: string[] = [];
      
      const headings = this.extractHeadings(htmlContent);
      if (headings.length > 0) {
        info.push(`제목 구조: ${headings.join(' > ')}`);
      }
      
      const metaInfo = this.extractMetaData(htmlContent);
      if (metaInfo.length > 0) {
        info.push(`메타 정보: ${metaInfo.join(', ')}`);
      }
      
      return info.length > 0 ? info.join(' | ') : null;
    } catch (error) {
      console.error('폴백 HTML 파싱 오류:', error);
      return null;
    }
  }

  /**
   * HTML에서 제목 태그를 추출합니다
   */
  private extractHeadings(htmlContent: string): string[] {
    const headings: string[] = [];
    const headingRegex = /<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi;
    let match;
    
    while ((match = headingRegex.exec(htmlContent)) !== null) {
      const headingText = match[1].trim();
      if (headingText && headingText.length > 0) {
        headings.push(headingText);
      }
    }
    
    return headings.slice(0, 5); // 최대 5개까지만
  }

  /**
   * HTML에서 메타 데이터를 추출합니다
   */
  private extractMetaData(htmlContent: string): string[] {
    const metaInfo: string[] = [];
    
    // 작성자 정보
    const authorMatch = htmlContent.match(/<meta[^>]*name=['"]?author['"]?[^>]*content=['"]?([^'"]+)['"]?/i);
    if (authorMatch) {
      metaInfo.push(`작성자: ${authorMatch[1]}`);
    }
    
    // 발행일
    const dateMatch = htmlContent.match(/<meta[^>]*name=['"]?(published|date)['"]?[^>]*content=['"]?([^'"]+)['"]?/i);
    if (dateMatch) {
      metaInfo.push(`발행일: ${dateMatch[2]}`);
    }
    
    // 키워드
    const keywordMatch = htmlContent.match(/<meta[^>]*name=['"]?keywords['"]?[^>]*content=['"]?([^'"]+)['"]?/i);
    if (keywordMatch) {
      metaInfo.push(`키워드: ${keywordMatch[1]}`);
    }
    
    return metaInfo;
  }

  /**
   * HTML에서 리스트 항목을 추출합니다
   */
  private extractListItems(htmlContent: string): string[] {
    const listItems: string[] = [];
    const listRegex = /<li[^>]*>([^<]+)<\/li>/gi;
    let match;
    
    while ((match = listRegex.exec(htmlContent)) !== null) {
      const itemText = match[1].trim();
      if (itemText && itemText.length > 0 && itemText.length < 100) {
        listItems.push(itemText);
      }
    }
    
    return listItems.slice(0, 10); // 최대 10개까지만
  }

  /**
   * HTML에서 중요한 링크를 추출합니다
   */
  private extractImportantLinks(htmlContent: string): string[] {
    const links: string[] = [];
    const linkRegex = /<a[^>]*href=['"]?([^'"]+)['"]?[^>]*>([^<]+)<\/a>/gi;
    let match;
    
    while ((match = linkRegex.exec(htmlContent)) !== null) {
      const linkUrl = match[1];
      const linkText = match[2].trim();
      
      // 외부 링크이고 의미있는 텍스트가 있는 경우만
      if (linkUrl.startsWith('http') && linkText && linkText.length > 3 && linkText.length < 50) {
        links.push(`${linkText}(${linkUrl})`);
      }
    }
    
    return links.slice(0, 5); // 최대 5개까지만
  }
} 