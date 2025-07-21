import { Injectable } from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';

@Injectable()
export class NewsletterPromptTemplatesService {
  private simpleNewsletterTemplate: PromptTemplate;
  private simpleNewsletterTitleTemplate: PromptTemplate;

  constructor() {
    this.initializeSimpleTemplate();
  }

  /**
   * 단순한 템플릿 초기화
   */
  private initializeSimpleTemplate(): void {
    this.simpleNewsletterTemplate = PromptTemplate.fromTemplate(
      `당신은 1000억 뷰를 넘는 뉴스레터 작가입니다. 주어진 정보를 통해 글을 대필해서 다른 뉴스레터 작가가 당신과 같이 1000억 뷰를 넘을 수 있도록 도와주세요.
      당신은 최고의 초안을 써서 다른 뉴스레터 작가가 당신과 같이 1000억 뷰를 넘을 수 있도록 도와주고 있으며, 당신의 초안이 너무 좋아서 다른 작가가 수정하지 않고 그대로 발행할 수 있도록 도와주세요.
      당신이 쓴 글에서 당신이 1000억뷰 작가임을 드러내지 않고 그냥 다른 작가가 쓴 글처럼 작성해주세요.

작성 법칙:
0. 뉴스레터 작성 시 무조건 마크다운 문법을 따라서 작성할 것
1. 본문은 독자에게 실질적 가치를 제공
2. 친근하면서도 전문적인 톤 유지
3. 스크랩 데이터의 핵심 내용을 잘 반영
4. 3-5개 문단으로 구성
5. 무조건 한국어로 작성할 것
6. 헤딩으로 섹션을 구분할 것. 각 섹션은 최소 1 depth 이상 작성할 것.
7. 중요한 내용은 굵게 표시할 것
8. 최소 2000자 이상 작성할 것
9. 순서 리스트는 사용하지말고, bullet point로 작성할 것
10. 줄바꿈은 무조건 마크다운 문법을 따라서 작성할 것. *** 이런식으로 작성하지 말고, 줄바꿈을 해주세요.

주제: {topic}
핵심 인사이트: {keyInsight}
생성 파라미터: {generationParams}

스크랩 데이터:
{scrapContent}

뉴스레터 본문만 작성해주세요. 제목은 포함하지 마세요.`,
    );

    this.simpleNewsletterTitleTemplate = PromptTemplate.fromTemplate(
      `당신은 전문적인 뉴스레터 작성자입니다. 주어진 뉴스레터 내용에 맞는 매력적인 제목을 작성해 주세요.

주제: {topic}
핵심 인사이트: {keyInsight}
생성 파라미터: {generationParams}

뉴스레터 내용:
{content}

작성 법칙:
1. 마크다운을 사용하지 말 것
2. 독자들이 호기심을 가지는 제목을 작성할 것
3. plain text로 작성할 것
4. 최대 100자 이내로 작성할 것

위 내용에 맞는 간결하고 매력적인 제목을 하나만 작성해주세요.`,
    );
  }

  /**
   * 템플릿 게터 메서드
   */
  getSimpleNewsletterTemplate(): PromptTemplate {
    return this.simpleNewsletterTemplate;
  }

  getSimpleNewsletterTitleTemplate(): PromptTemplate {
    return this.simpleNewsletterTitleTemplate;
  }
}
