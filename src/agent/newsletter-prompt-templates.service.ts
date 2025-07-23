import { Injectable } from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';

@Injectable()
export class NewsletterPromptTemplatesService {
  private simpleNewsletterTemplate: PromptTemplate;
  private simpleNewsletterTitleTemplate: PromptTemplate;
  private structureAnalysisTemplate: PromptTemplate; // New template

  constructor() {
    this.initializeSimpleTemplate();
    this.initializeStructureAnalysisTemplate(); // Initialize new template
  }

  /**
   * 글 구조 분석 템플릿 초기화
   */
  private initializeStructureAnalysisTemplate(): void {
    this.structureAnalysisTemplate = PromptTemplate.fromTemplate(
      `# 페르소나
당신은 모든 종류의 글을 분석하여 체계적인 구조로 정리하는 전문 콘텐츠 구조 설계자입니다.

# 목표
주어진 텍스트의 구조를 헤딩 계층(#, ##, ###, ####)에 따라 분석하고, 재사용 가능한 범용 템플릿을 JSON 형식으로 생성합니다.

## 분석할 텍스트:
{content}

# 절대 법칙:
- **JSON 출력 형식을 무조건 따를 것. 다른 어떤 텍스트도 포함해서는 안 됩니다.**

# 작성 법칙:
0. 무조건 한국어로 작성하세요.
1. **가장 중요한 규칙:** 주어진 텍스트의 헤딩(Heading, #) 계층을 기반으로 JSON의 깊이(depth)를 결정하세요.
    - 상위 헤딩(예: ##)은 상위 섹션이 됩니다.
    - 상위 헤딩 아래에 있는 하위 헤딩(예: ### 또는 ####)들은 해당 상위 섹션의 children 배열 안에 하위 섹션으로 포함시키세요.
2. 각 섹션의 (title)은 헤딩의 내용을 그대로 복사하지 말고, 해당 섹션의 핵심 역할이나 주제를 나타내는 **범용적인 명칭**으로 재작성하세요. (예: '문제 제기', '핵심 기능 소개', '사례 분석', '전문가 조언')
4. (title)은 20자 이내로 길이를 제한하세요.
5. 주어진 텍스트의 헤딩과 글의 내용을 기반하여 최대한 범용적인 템플릿을 생성할 것.

## 출력 형식
JSON 출력 형식:
{{
  "sections": [
    {{
      "title": "상위 섹션 1 제목",
      "children": []
    }},
    {{
      "title": "상위 섹션 2 제목",
      "children": [
        {{
          "title": "하위 섹션 2-1 제목",
          "children": []
        }},
        {{
          "title": "하위 섹션 2-2 제목",
          "children": []
        }}
      ]
    }},
    ...
  ]
}}`
    );
  }

  /**
   * 단순한 템플릿 초기화
   */
  private initializeSimpleTemplate(): void {
    this.simpleNewsletterTemplate = PromptTemplate.fromTemplate(
      `
**당신은 1000억 뷰를 넘는 뉴스레터 작가입니다. 주어진 context와 following rules에 따라 뉴스레터를 작성해주세요.**

<rules>
# Base Rules
- 뉴스레터 작성 시 무조건 마크다운 문법을 따라서 작성할 것
- 본문은 독자에게 실질적 가치를 제공
- 친근하면서도 전문적인 톤 유지
- 스크랩 데이터의 핵심 내용을 잘 반영
- 3-5개 문단으로 구성
- 무조건 한국어로 작성할 것
- 헤딩으로 섹션을 구분할 것. 각 섹션은 최소 1 depth 이상 작성할 것.
- 중요한 내용은 굵게 표시할 것
- 별도의 요청 글자수가 없다면, 최소 2000자 이상 작성할 것
- 순서 리스트는 사용하지말고, bullet point로 작성할 것
- 줄바꿈은 무조건 마크다운 문법을 따라서 작성할 것. *** 이런식으로 작성하지 말고, 줄바꿈을 해주세요.

# If given structure template
- 구조 템플릿의 각 섹션별 title과 insight를 참고하여 작성할 것.
- 구조 템플릿의 각 섹션별 children을 참고하여 작성할 것.
- 구조 템플릿의 각 섹션별 children의 각 섹션별 title과 insight를 참고하여 작성할 것.
- 구조 템플릿의 각 섹션별 children의 각 섹션별 children을 참고하여 작성할 것.
- 구조 템플릿의 각 섹션별 children의 각 섹션별 children의 각 섹션별 title과 insight를 참고하여 작성할 것.
- 구조 템플릿의 각 섹션별 children의 각 섹션별 children의 각 섹션별 children을 참고하여 작성할 것.
- 구조 템플릿의 각 섹션별 children의 각 섹션별 children의 각 섹션별 children의 각 섹션별 title과 insight를 참고하여 작성할 것.
</rules>

<context>
주제: {topic}
핵심 인사이트: {keyInsight}
생성 파라미터: {generationParams}
구조 템플릿: {articleStructureTemplate}

스크랩 데이터:
{scrapContent}
</context>

<response format>
오직 뉴스레터 본문만 작성해주세요. 제목은 포함하지 마세요.
</response format>`,
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

  /**
   * 구조 분석 템플릿 게터 메서드
   */
  getStructureAnalysisTemplate(): PromptTemplate {
    return this.structureAnalysisTemplate;
  }
}
