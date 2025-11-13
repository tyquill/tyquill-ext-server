import { Injectable, Logger } from '@nestjs/common';
import { ChatVertexAI } from '@langchain/google-vertexai';
import { VertexAiFactory } from '../ai-workflows/services/vertex-ai.factory';

/**
 * 빠른 Slack 보고서 생성 서비스
 *
 * 복잡한 워크플로우 대신 단일 LLM 호출로 5-10초 내에 보고서 생성
 */
@Injectable()
export class SlackReportGeneratorService {
  private readonly logger = new Logger(SlackReportGeneratorService.name);
  private readonly llm: ChatVertexAI;

  constructor(private readonly vertexFactory: VertexAiFactory) {
    // Gemini 2.5 Flash Lite - 빠른 응답 모델
    this.llm = this.vertexFactory.buildChat({
      model: 'gemini-2.5-flash-lite',
      temperature: 0.7,
      thinkingBudget: 0,
      maxOutputTokens: 8192,
    });

    this.logger.log('SlackReportGeneratorService initialized with gemini-2.5-flash-lite');
  }

  /**
   * Slack 메시지로부터 주간 보고서 생성
   *
   * @param input 보고서 생성에 필요한 입력 데이터
   * @returns 생성된 제목과 마크다운 콘텐츠
   */
  async generateReport(input: {
    topic: string;
    keyInsight: string;
    messages: string;
  }): Promise<{ title: string; content: string }> {
    this.logger.log('Generating report with single LLM call', {
      topic: input.topic,
      messageLength: input.messages.length,
    });

    const startTime = Date.now();

    try {
      const prompt = this.buildPrompt(input);

      this.logger.debug('Invoking Gemini 2.5 Flash Lite', {
        promptLength: prompt.length,
      });

      // 단일 LLM 호출
      const response = await this.llm.invoke(prompt);

      const elapsedTime = Date.now() - startTime;

      this.logger.log('LLM response received', {
        elapsedTime: `${elapsedTime}ms`,
        contentLength: typeof response.content === 'string' ? response.content.length : 0,
      });

      // 응답 파싱
      const result = this.parseResponse(response.content);

      this.logger.log('Report generated successfully', {
        title: result.title,
        contentLength: result.content.length,
        totalTime: `${Date.now() - startTime}ms`,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to generate report', error);
      throw error;
    }
  }

  /**
   * LLM 프롬프트 생성
   */
  private buildPrompt(input: {
    topic: string;
    keyInsight: string;
    messages: string;
  }): string {
    return `당신은 Slack 메시지를 분석하여 전문적인 주간 업무 보고서를 작성하는 비서입니다.

<역할>
팀원들의 Slack 메시지를 분석하여 핵심 업무 내용을 파악하고,
경영진에게 보고할 수 있는 체계적이고 전문적인 주간 보고서를 작성합니다.
</역할>

<작성 규칙>
1. 캐주얼한 Slack 대화를 전문적인 업무 보고서 톤으로 변환하세요
2. 중복된 내용은 제거하고 핵심만 추출하세요
3. 정량적 성과와 구체적인 진행 상황을 강조하세요
4. 날짜별 또는 프로젝트별로 논리적으로 구조화하세요
5. Slack mrkdwn 형식으로 작성하세요 (표준 마크다운과 다름!)
6. 다음 주 계획이나 액션 아이템이 있다면 포함하세요
</작성 규칙>

<Slack mrkdwn 포맷 규칙>
CRITICAL: Slack은 표준 마크다운과 다른 형식을 사용합니다!

✅ 올바른 Slack mrkdwn:
- 볼드체: *텍스트* (별표 1개)
- 이탤릭: _텍스트_ (언더스코어)
- 취소선: ~텍스트~
- 코드: \`code\`
- 링크: <https://example.com|링크 텍스트> 또는 <https://example.com>
- 리스트: • 또는 - 로 시작
- 이모지: :chart_with_upwards_trend: (영어 코드만 가능)

❌ 사용 금지:
- ## 제목 (헤더 문법 없음 - 대신 *볼드체*로 제목 표현)
- **텍스트** (별표 2개는 렌더링 안됨)
- [텍스트](url) (마크다운 링크 문법 안됨)
- :막대_차트: (한글 이모지 코드 안됨)

이모지 매핑 (반드시 영어 코드 사용):
- 📊 차트 → :bar_chart:
- 📈 상승 → :chart_with_upwards_trend:
- 🔍 검색 → :mag:
- 🎯 목표 → :dart:
- ✅ 체크 → :white_check_mark:
- 💡 아이디어 → :bulb:
- 🚀 로켓 → :rocket:
- ⚡ 번개 → :zap:
- 🏆 트로피 → :trophy:
- 📅 날짜 → :calendar:
- ✨ 반짝임 → :sparkles:
- 💬 말풍선 → :speech_balloon:
- 📄 문서 → :page_facing_up:
- 📝 메모 → :memo:
- ⭐ 별 → :star:

경고: :막대_차트:, :반짝임:, :말풍선: 같은 한글 이모지 코드는 절대 사용하지 마세요!
반드시 :bar_chart:, :sparkles:, :speech_balloon: 같은 영어 코드만 사용하세요!
</Slack mrkdwn 포맷 규칙>

<출력 형식>
반드시 다음 Slack mrkdwn 형식으로 출력하세요:

TITLE: [간결하고 명확한 보고서 제목 - 20자 이내]

CONTENT:
*:bar_chart: 요약*
[핵심 성과와 주요 업무를 3-5줄로 요약. *중요한 키워드*는 볼드 처리.]

*:mag: 주요 활동*

*프로젝트 A 진행*
• *날짜*: 주요 업무 내용을 구체적으로 작성
• 정량적 성과가 있다면 숫자와 함께 명시
• 링크가 있다면 <https://example.com|링크 텍스트> 형식 사용

*프로젝트 B 개발*
• 업무 내용 1
• 업무 내용 2

*:chart_with_upwards_trend: 성과 및 지표*
[정량적 성과를 숫자와 함께 명시]

*:dart: 다음 주 계획*
• 액션 아이템 1
• 액션 아이템 2

주의사항:
- 헤더는 *볼드체*로만 표현 (##이나 ### 사용 금지)
- 영어 이모지 코드만 사용 (:bar_chart:, :sparkles: 등)
- 링크는 <url|text> 형식
- 리스트는 • 로 시작
</출력 형식>

<입력 데이터>
기간: ${input.topic}
핵심 인사이트: ${input.keyInsight}

Slack 메시지:
${input.messages}
</입력 데이터>

위 Slack 메시지들을 분석하여 전문적인 주간 업무 보고서를 작성해주세요.
캐주얼한 표현은 모두 비즈니스 톤으로 변환하고, 중요한 업무 내용만 추출하세요.
반드시 Slack mrkdwn 형식 규칙을 정확히 따라주세요!
`;
  }

  /**
   * LLM 응답 파싱
   *
   * TITLE: ... 과 CONTENT: ... 형식에서 추출
   */
  private parseResponse(llmResponse: unknown): { title: string; content: string } {
    // llmResponse를 문자열로 변환
    let text: string;

    if (typeof llmResponse === 'string') {
      text = llmResponse;
    } else if (llmResponse && typeof llmResponse === 'object' && 'content' in llmResponse) {
      const contentValue = (llmResponse as { content: unknown }).content;
      text = String(contentValue || '');
    } else {
      text = String(llmResponse || '');
    }

    this.logger.debug('Parsing LLM response', {
      textLength: text.length,
      preview: text.substring(0, 200),
    });

    // TITLE: 추출
    const titleMatch = text.match(/TITLE:\s*(.+?)(?:\n|$)/i);
    const title = titleMatch
      ? titleMatch[1].trim()
      : '주간 업무 보고서';

    // CONTENT: 이후 부분 추출
    const contentMatch = text.match(/CONTENT:\s*([\s\S]+)/i);
    const contentPart = contentMatch
      ? contentMatch[1].trim()
      : text;

    // 만약 구조화된 응답이 아니라면 전체를 content로 사용
    const finalContent = contentPart.length > 100 ? contentPart : text;

    this.logger.debug('Parsed response', {
      title,
      contentLength: finalContent.length,
    });

    return { title, content: finalContent };
  }
}
