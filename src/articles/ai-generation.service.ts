import { Injectable } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { Scrap } from '../scraps/entities/scrap.entity';
import { ScrapCombinationService } from './scrap-combination.service';

export interface ScrapWithComment {
  scrap: Scrap;
  userComment?: string;
}

export interface GenerateContentInput {
  topic: string;
  keyInsight?: string;
  scrapsWithComments: ScrapWithComment[];
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

  constructor(
    private readonly scrapCombinationService: ScrapCombinationService,
  ) {
    this.model = new ChatGoogleGenerativeAI({
      model: 'gemini-2.0-flash',
      temperature: 0.7,
      apiKey: process.env.GOOGLE_API_KEY,
    });

    this.promptTemplate = PromptTemplate.fromTemplate(`
당신은 전문적인 뉴스레터 작성자입니다. AI 기반 분석을 통해 정리된 정보를 바탕으로 매력적이고 통찰력 있는 뉴스레터를 작성해주세요.

주제: {topic}
{keyInsight}
{userRequests}

{scrapContent}

다음 형식으로 응답해주세요:
TITLE: [제목]
CONTENT: [본문 내용]

작성 지침:
1. 제목은 핵심 포인트를 반영하여 흥미롭고 클릭하고 싶게 만들어주세요
2. AI 요약과 구조화된 정보를 활용하여 정확하고 풍부한 내용을 작성해주세요
3. 각 스크랩의 사용자 의견과 핵심 포인트를 적극 반영해주세요
4. 콘텐츠 유형(뉴스, 블로그, 기술문서 등)에 맞는 톤앤매너를 사용해주세요
5. 구조화된 정보(제목 구조, 주요 요소 등)를 활용하여 논리적으로 구성해주세요
6. 개인적인 인사이트와 분석을 추가하되, 사실과 의견을 명확히 구분해주세요
7. 사용자의 추가 요청사항이 있다면 반드시 반영해주세요
8. 뉴스레터 형식으로 독자가 읽기 쉽게 구성해주세요
9. 출처와 관련 링크를 자연스럽게 본문에 포함시켜주세요
10. 메타 정보(작성자, 발행일 등)가 있다면 신뢰성 있게 인용해주세요
`);
  }

  /**
   * 스크랩 데이터와 사용자 입력을 기반으로 AI 아티클을 생성합니다
   */
  async generateArticle(input: GenerateContentInput): Promise<GeneratedContent> {
    const scrapContent = await this.scrapCombinationService.formatForAiPromptWithComments(input.scrapsWithComments);
    
    const chain = this.promptTemplate.pipe(this.model).pipe(new StringOutputParser());
    
    const result = await chain.invoke({
      topic: input.topic,
      keyInsight: input.keyInsight ? `핵심 인사이트: ${input.keyInsight}` : '',
      userRequests: input.generationParams ? `사용자 추가 요청사항: ${input.generationParams}` : '',
      scrapContent,
    });

    return this.parseGeneratedContent(result);
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