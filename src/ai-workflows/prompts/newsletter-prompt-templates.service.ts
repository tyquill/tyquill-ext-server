import { Injectable } from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';

@Injectable()
export class NewsletterPromptTemplatesService {
  private readonly simpleNewsletterTemplate: PromptTemplate;
  private readonly simpleNewsletterTitleTemplate: PromptTemplate;
  private readonly articleReflectorTemplate: PromptTemplate;
  private readonly writingStyleRewriteTemplate: PromptTemplate;
  private readonly structureAnalysisTemplate: PromptTemplate;

  // Korean-specific templates
  private readonly koreanNewsletterTemplate: PromptTemplate;
  private readonly koreanNewsletterTitleTemplate: PromptTemplate;
  private readonly koreanArticleReflectorTemplate: PromptTemplate;
  private readonly koreanWritingStyleRewriteTemplate: PromptTemplate;

  constructor() {
    this.simpleNewsletterTemplate = PromptTemplate.fromTemplate(`
**당신은 최고의 뉴스레터 작가입니다. 주어진 context와 rules에 따라 뉴스레터를 작성해주세요.**

<rules>
# Base Rules
- You must write in markdown format.
- The content must provide practical value to the reader.
- The content must be written in a friendly and professional tone.
- The content must reflect the core content of the scrap data.
- The content must be written in 3-5 paragraphs.
- The content must be written in English.
- The content must be divided into sections by headings. Each section must be written with a minimum of 1 depth.
- Do not write in the format of ### #1, write in the format of ### 1.
- Important content must be bolded.
- If there is no additional request for the number of characters, the content must be written with a minimum of 2000 characters.
- Use bullet points instead of ordered lists.
- Must not use *** to write horizontal rules, use --- instead.
- Heading range from # to ###.

# If given structure template
- Refer to the title and insight of each section of the structure template for writing.
- Refer to the children of each section of the structure template for writing.
- Refer to the title and insight of each section of the structure template for writing.
- Refer to the children of each section of the structure template for writing.
- Refer to the title and insight of each section of the structure template for writing.
- Refer to the children of each section of the structure template for writing.
- Refer to the title and insight of each section of the structure template for writing.
- Refer to the children of each section of the structure template for writing.
- Refer to the title and insight of each section of the structure template for writing.
- Refer to the children of each section of the structure template for writing.

# If given feedbacks
- Refer to the previous generatedNewsletter and feedback in {feedbacks} for writing.
</rules>

<context>
Topic: {topic}
Key Insight: {keyInsight}
Generation Parameters: {generationParams}
Structure Template: {articleStructureTemplate}

Scrap Data:
{scrapContent}

PDF Content:
{pdfContent}

Feedbacks:
{feedbacks}
</context>

<response format>
Only write the newsletter content. Do not include the title.
</response format>`);

    this.simpleNewsletterTitleTemplate =
      PromptTemplate.fromTemplate(`You are a professional newsletter writer. Write a compelling title for the given newsletter content.

Topic: {topic}
Key Insight: {keyInsight}
Generation Parameters: {generationParams}

Newsletter Content:
{content}

Writing Rules:
1. Do not use markdown.
2. Write a title that interests the reader.
3. Write in plain text.
4. Write with a maximum of 100 characters.

Write a concise and compelling title for the above content.`);

    this.articleReflectorTemplate = PromptTemplate.fromTemplate(`
You are a professional newsletter editor. Read the newsletter content {content} for the topic {topic} and key insight {keyInsight}, and write deep feedback based on the following criteria.

<rules>
- Evaluate if the core message being conveyed in the article is clearly revealed.
- Evaluate if the structure of the article is systematic and logical.
- Evaluate if the tone and style of the article are appropriate.
- Evaluate if the content of the article reflects the topic and key insight.
- Evaluate if the article reflects the title and idea of {articleStructureTemplate}.
</rules>

<response format>
**Only** write feedback for the newsletter.
</response format>`);

    this.writingStyleRewriteTemplate =
      PromptTemplate.fromTemplate(`You are a professional writing style conversion expert. Rewrite the given newsletter content according to the writing style example.

<rules>
- Keep the core message and structure of the original content, but change the writing style.
- Analyze the tone, style, and sentence structure of the writing style example and apply it.
- Keep the markdown format.
- Keep the logical flow of the content.
- Write in English.
- Must not use *** to write horizontal rules, use --- instead.
- Use '-' for bullet points.
- Write in the standard markdown format.
</rules>

<context>
Topic: {topic}
Key Insight: {keyInsight}

Original Newsletter Content:
{content}

Writing Style Example:
{writingStyleExamples}
</context>

<response format>
Rewrite the newsletter content according to the writing style example. Do not include the title.
</response format>`);

    this.structureAnalysisTemplate = PromptTemplate.fromTemplate(`# Persona
You are a professional content structure designer who analyzes and organizes all types of articles into a systematic structure.

# Goal
Analyze the structure of the given text by heading hierarchy (#, ##, ###, ####), and produce a reusable section outline as a **flat JSON array**.

## Text to Analyze:
{content}

# Absolute Rules:
- Output **must** be valid JSON with no additional commentary, code fences, or markdown.
- Each section must include: "title" (string), "level" (number), and "parent_index" (integer or null).

# Writing Rules:
0. Write titles in English.
1. Determine \`level\` strictly from the heading depth (# → 1, ## → 2, ### → 3, #### → 4).
2. Use 0-based indexing for sections in order of appearance.
3. For every section after the first, set \`parent_index\` to the index of its direct parent section (null for top-level).
4. Rewrite each title into a **concise, generic label** (max 20 characters) that captures the section's role (e.g. "Problem Intro", "Key Findings").
5. Ensure the array order matches the document flow from top to bottom.

## Output Format
{{
  "sections": [
    {{
      "title": "Section Summary",
      "level": 1,
      "parent_index": null
    }},
    {{
      "title": "Supporting Idea",
      "level": 2,
      "parent_index": 0
    }},
    {{
      "title": "Evidence",
      "level": 3,
      "parent_index": 1
    }}
  ]
}}`);

    // Korean-specific templates
    this.koreanNewsletterTemplate = PromptTemplate.fromTemplate(`
**당신은 최고의 뉴스레터 작가입니다. 주어진 context와 rules에 따라 뉴스레터를 작성해주세요.**

<rules>
# 기본 규칙
- 마크다운 형식으로 작성해야 합니다.
- 독자에게 실질적인 가치를 제공하는 콘텐츠여야 합니다.
- 친근하면서도 전문적인 어조로 작성해야 합니다.
- 스크랩 데이터의 핵심 내용을 충실히 반영해야 합니다.
- 3-5개의 문단으로 구성해야 합니다.
- **한국어로 작성해야 합니다.**
- 제목을 통해 섹션을 구분하며, 각 섹션은 최소 1단계 깊이로 작성되어야 합니다.
- ### #1 형식이 아닌 ### 1. 형식으로 작성합니다.
- 중요한 내용은 **굵은 글씨**로 강조합니다.
- 글자 수에 대한 추가 요청이 없다면, 최소 2000자 이상으로 작성해야 합니다.
- 순서 있는 목록보다 불릿 포인트(•, -, *)를 사용합니다.
- 수평선은 ***가 아닌 --- 를 사용합니다.
- 제목 레벨은 # 에서 ### 까지만 사용합니다.

# 구조 템플릿이 주어진 경우
- 구조 템플릿 각 섹션의 제목과 인사이트를 참고하여 작성합니다.
- 각 섹션의 하위 항목들을 충실히 반영합니다.
- 템플릿의 논리적 흐름을 유지하면서 내용을 풍부하게 전개합니다.

# 피드백이 주어진 경우
- {feedbacks}의 이전 generatedNewsletter와 피드백을 참고하여 개선된 내용을 작성합니다.
- 지적된 문제점들을 구체적으로 해결합니다.

# 한국어 작성 가이드라인
- 자연스러운 한국어 표현을 사용합니다.
- 전문 용어는 독자가 이해하기 쉽게 설명하거나 필요시 영어를 병기합니다.
- 한국 독자의 문화적 맥락과 관심사를 고려합니다.
- 문장은 간결하고 명확하게, 한국어 문법에 맞게 작성합니다.
</rules>

<context>
주제: {topic}
핵심 인사이트: {keyInsight}
생성 파라미터: {generationParams}
구조 템플릿: {articleStructureTemplate}

스크랩 데이터:
{scrapContent}

PDF 콘텐츠:
{pdfContent}

피드백:
{feedbacks}
</context>

<response format>
뉴스레터 본문만 작성하세요. 제목은 포함하지 마세요.
</response format>`);

    this.koreanNewsletterTitleTemplate = PromptTemplate.fromTemplate(`
당신은 전문 뉴스레터 작가입니다. 주어진 뉴스레터 콘텐츠에 대한 매력적인 제목을 작성하세요.

주제: {topic}
핵심 인사이트: {keyInsight}
생성 파라미터: {generationParams}

뉴스레터 콘텐츠:
{content}

작성 규칙:
1. 마크다운을 사용하지 마세요.
2. 독자의 관심을 끄는 제목을 작성하세요.
3. 일반 텍스트로 작성하세요.
4. 최대 50자 이내로 작성하세요 (한국어 기준).
5. 클릭을 유도하는 호기심 자극 요소를 포함하세요.
6. 구체적이면서도 간결한 표현을 사용하세요.

위 콘텐츠에 대한 간결하고 매력적인 한국어 제목을 작성하세요.`);

    this.koreanArticleReflectorTemplate = PromptTemplate.fromTemplate(`
당신은 전문 뉴스레터 에디터입니다. 주제 {topic}과 핵심 인사이트 {keyInsight}에 대한 뉴스레터 콘텐츠 {content}를 읽고, 다음 기준에 따라 깊이 있는 피드백을 작성하세요.

<평가 기준>
- 기사에서 전달하려는 핵심 메시지가 명확하게 드러나는지 평가합니다.
- 기사의 구조가 체계적이고 논리적인지 평가합니다.
- 기사의 어조와 문체가 적절한지 평가합니다.
- 기사의 내용이 주제와 핵심 인사이트를 충실히 반영하는지 평가합니다.
- {articleStructureTemplate}의 제목과 아이디어가 적절히 반영되었는지 평가합니다.
- 한국어 표현의 자연스러움과 가독성을 평가합니다.
- 독자 관점에서 유용하고 흥미로운 내용인지 평가합니다.
</평가 기준>

<피드백 작성 가이드>
- 구체적이고 실행 가능한 개선 제안을 포함하세요.
- 잘된 점과 개선이 필요한 점을 균형있게 다루세요.
- 각 평가 항목별로 명확한 의견을 제시하세요.
- 한국어 문법과 표현에 대한 구체적 조언을 포함하세요.
</피드백 작성 가이드>

<response format>
뉴스레터에 대한 피드백**만** 작성하세요.
</response format>`);

    this.koreanWritingStyleRewriteTemplate = PromptTemplate.fromTemplate(`
당신은 전문 문체 변환 전문가입니다. 주어진 뉴스레터 콘텐츠를 문체 예시에 따라 재작성하세요.

<규칙>
- 원본 콘텐츠의 핵심 메시지와 구조는 유지하되, 문체를 변경합니다.
- 문체 예시의 어조, 스타일, 문장 구조를 분석하여 적용합니다.
- 마크다운 형식을 유지합니다.
- 콘텐츠의 논리적 흐름을 유지합니다.
- **한국어로 작성합니다.**
- 수평선은 ***가 아닌 --- 를 사용합니다.
- 불릿 포인트는 '-'를 사용합니다.
- 표준 마크다운 형식으로 작성합니다.

# 한국어 문체 적용 가이드
- 예시 문체의 특징적인 어휘 선택 패턴을 파악하여 적용합니다.
- 문장의 길이와 리듬감을 예시와 유사하게 조정합니다.
- 높임말 수준(합쇼체/해요체/반말)을 예시와 일치시킵니다.
- 전문성 수준과 친근감의 균형을 예시에 맞춥니다.
- 한국어 특유의 표현 방식과 관용구를 적절히 활용합니다.
</규칙>

<context>
주제: {topic}
핵심 인사이트: {keyInsight}

원본 뉴스레터 콘텐츠:
{content}

문체 예시:
{writingStyleExamples}
</context>

<response format>
문체 예시에 따라 뉴스레터 콘텐츠를 재작성하세요. 제목은 포함하지 마세요.
</response format>`);
  }

  getSimpleNewsletterTemplate(): PromptTemplate {
    return this.simpleNewsletterTemplate;
  }

  getSimpleNewsletterTitleTemplate(): PromptTemplate {
    return this.simpleNewsletterTitleTemplate;
  }

  getArticleReflectorTemplate(): PromptTemplate {
    return this.articleReflectorTemplate;
  }

  getWritingStyleRewriteTemplate(): PromptTemplate {
    return this.writingStyleRewriteTemplate;
  }

  getStructureAnalysisTemplate(): PromptTemplate {
    return this.structureAnalysisTemplate;
  }

  // Korean-specific template getters
  getKoreanNewsletterTemplate(): PromptTemplate {
    return this.koreanNewsletterTemplate;
  }

  getKoreanNewsletterTitleTemplate(): PromptTemplate {
    return this.koreanNewsletterTitleTemplate;
  }

  getKoreanArticleReflectorTemplate(): PromptTemplate {
    return this.koreanArticleReflectorTemplate;
  }

  getKoreanWritingStyleRewriteTemplate(): PromptTemplate {
    return this.koreanWritingStyleRewriteTemplate;
  }
}
