import { Injectable } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { Scrap } from '../scraps/entities/scrap.entity';

export interface GenerateContentInput {
  topic: string;
  keyInsight?: string;
  scraps: Scrap[];
  userComment?: string;
  generationParams?: string; // 사용자 자연어 요청사항
}

export interface GeneratedContent {
  title: string;
  content: string;
}

@Injectable()
export class AiGenerationService {
  private readonly model: ChatGoogleGenerativeAI;
  private readonly promptTemplate: PromptTemplate;

  constructor() {
    this.model = new ChatGoogleGenerativeAI({
      model: 'gemini-2.0-flash-exp',
      temperature: 0.7,
      apiKey: process.env.GOOGLE_API_KEY,
    });

    this.promptTemplate = PromptTemplate.fromTemplate(`
당신은 전문적인 뉴스레터 작성자입니다. 주어진 정보를 바탕으로 매력적이고 유익한 뉴스레터를 작성해주세요.

주제: {topic}
{keyInsight}
{userComment}
{userRequests}

스크랩된 콘텐츠:
{scrapContent}

다음 형식으로 응답해주세요:
TITLE: [제목]
CONTENT: [본문 내용]

제목은 흥미롭고 클릭하고 싶게 만들어주세요.
본문은 스크랩된 콘텐츠의 핵심 정보를 잘 정리하고, 개인적인 인사이트를 추가해주세요.
사용자의 추가 요청사항이 있다면 반드시 반영해주세요.
`);
  }

  /**
   * 스크랩 데이터와 사용자 입력을 기반으로 AI 아티클을 생성합니다
   */
  async generateArticle(input: GenerateContentInput): Promise<GeneratedContent> {
    const scrapContent = this.formatScrapContent(input.scraps);
    
    const chain = this.promptTemplate.pipe(this.model).pipe(new StringOutputParser());
    
    const result = await chain.invoke({
      topic: input.topic,
      keyInsight: input.keyInsight ? `핵심 인사이트: ${input.keyInsight}` : '',
      userComment: input.userComment ? `사용자 코멘트: ${input.userComment}` : '',
      userRequests: input.generationParams ? `사용자 추가 요청사항: ${input.generationParams}` : '',
      scrapContent,
    });

    return this.parseGeneratedContent(result);
  }

  /**
   * 스크랩 콘텐츠를 포맷팅합니다
   */
  private formatScrapContent(scraps: Scrap[]): string {
    return scraps.map((scrap, index) => {
      let formatted = `${index + 1}. ${scrap.title}\n`;
      formatted += `URL: ${scrap.url}\n`;
      formatted += `내용: ${scrap.content}\n`;
      if (scrap.userComment) {
        formatted += `사용자 코멘트: ${scrap.userComment}\n`;
      }
      return formatted;
    }).join('\n---\n');
  }

  /**
   * 생성된 콘텐츠를 파싱합니다
   */
  private parseGeneratedContent(content: string): GeneratedContent {
    const titleMatch = content.match(/TITLE:\s*(.+)/);
    const contentMatch = content.match(/CONTENT:\s*([\s\S]+)/);

    return {
      title: titleMatch ? titleMatch[1].trim() : '제목 없음',
      content: contentMatch ? contentMatch[1].trim() : content,
    };
  }
} 