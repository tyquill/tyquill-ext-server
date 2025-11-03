import { Injectable } from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';

@Injectable()
export class NewsletterPromptTemplatesService {
  private readonly simpleNewsletterTemplate: PromptTemplate;
  private readonly simpleNewsletterTitleTemplate: PromptTemplate;
  private readonly articleReflectorTemplate: PromptTemplate;
  private readonly writingStyleRewriteTemplate: PromptTemplate;
  private readonly structureAnalysisTemplate: PromptTemplate;
  private readonly languagePreferenceDetectionTemplate: PromptTemplate;
  private readonly koreanTranslationTemplate: PromptTemplate;

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

    this.languagePreferenceDetectionTemplate =
      PromptTemplate.fromTemplate(`You are a linguistic analyst who decides whether the author of the newsletter inputs is likely a Korean speaker writing for Korean readers.

Inputs:
- Topic: {topic}
- Key Insight: {keyInsight}
- Generation Parameters: {generationParams}

Guidelines:
1. Evaluate cultural references, phrasing, and semantics found in the inputs.
2. Do not assume the user is Korean solely because Hangul appears; weigh overall intent and tone.
3. If the inputs are entirely in English or explicitly request English output, you must respond with isKoreanUser=false and confidence="low".
4. Only classify as Korean when there are strong signals (cultural intent, Korean-specific context, explicit request for Korean audience).
5. Respond with valid JSON only, following this schema:
   {{
     "isKoreanUser": boolean,
     "confidence": "low" | "medium" | "high",
     "reason": "short explanation in English"
   }}`);

    this.koreanTranslationTemplate =
      PromptTemplate.fromTemplate(`당신은 최고의 번역가입니다. 주어진 뉴스레터 제목과 본문을 자연스러운 한국어로 번역하세요.

<rules>
- 제목과 내용 모두 Markdown 형식을 유지하세요.
- 콘텐츠의 구조와 핵심 메시지를 유지하세요.
- 번역된 문장은 자연스럽고 유려한 한국어 문체여야 합니다.
- 전문 용어는 맥락에 맞게 적절한 한국어로 번역하거나 원어를 병기하세요.
</rules>

<context>
Title:
{title}

Content:
{content}
</context>

<response format>
{{
  "title": "번역된 제목",
  "content": "번역된 본문 (Markdown 유지)"
}}
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

  getLanguagePreferenceDetectionTemplate(): PromptTemplate {
    return this.languagePreferenceDetectionTemplate;
  }

  getKoreanTranslationTemplate(): PromptTemplate {
    return this.koreanTranslationTemplate;
  }
}
