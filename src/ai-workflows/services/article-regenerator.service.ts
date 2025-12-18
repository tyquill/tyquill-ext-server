import { Injectable, Logger } from '@nestjs/common';
import { ChatVertexAI } from '@langchain/google-vertexai';
import { z } from 'zod';

import { ScrapWithComment } from '../dto/newsletter.dto';
import {
  RegenerateArticleInput,
  RegenerateArticleOutput,
  ScrapReference,
} from '../dto/regenerate.dto';
import { VertexAiFactory } from './vertex-ai.factory';
import { ScrapCombinationService } from './scrap-combination.service';
import { LangfuseService } from './langfuse.service';

const REGENERATOR_MODEL = 'gemini-2.5-flash-lite';

// Zod schema for structured output
const RegenerateResponseSchema = z.object({
  title: z.string().describe('수정된 아티클 제목'),
  content: z.string().describe('수정된 본문 내용 (마크다운 형식)'),
  changesSummary: z.string().describe('변경사항 요약 (구체적으로 무엇이 바뀌었는지 설명)'),
});

type RegenerateResponse = z.infer<typeof RegenerateResponseSchema>;

@Injectable()
export class ArticleRegeneratorService {
  private readonly logger = new Logger(ArticleRegeneratorService.name);
  private readonly llm: ChatVertexAI;

  constructor(
    vertexFactory: VertexAiFactory,
    private readonly scrapCombinationService: ScrapCombinationService,
    private readonly langfuseService: LangfuseService,
  ) {
    this.llm = vertexFactory.buildChat({
      model: REGENERATOR_MODEL,
      temperature: 0.7,
      thinkingBudget: -1,
    });
  }

  async regenerateArticle(
    input: RegenerateArticleInput,
  ): Promise<RegenerateArticleOutput> {
    this.logger.log('Starting article regeneration with structured output');

    const startTime = Date.now();
    const prompt = await this.buildPrompt(input);

    // Create Langfuse CallbackHandler for tracing
    const langfuseHandler = this.langfuseService.createHandler({
      metadata: {
        topic: input.topic,
        conversationLength: input.conversationHistory?.length || 0,
        hasAddedScraps: (input.addedScraps?.length || 0) > 0,
        hasAdditionalScraps: (input.additionalScraps?.length || 0) > 0,
      },
      tags: ['article-regeneration', 'structured-output'],
    });

    const config = langfuseHandler ? { callbacks: [langfuseHandler] } : {};
    if (langfuseHandler) {
      this.logger.log('✅ Langfuse tracing enabled for article regeneration');
    }

    // Create structured LLM with Zod schema
    const structuredLLM = this.llm.withStructuredOutput(
      RegenerateResponseSchema,
      {
        name: 'ArticleRegeneration',
        method: 'functionCalling',
      },
    );

    let result: RegenerateArticleOutput;
    let response: any;

    try {
      // Attempt structured output
      const structuredResponse = await structuredLLM.invoke(prompt, config);
      const latencyMs = Date.now() - startTime;

      this.logger.log('Structured output received successfully');

      // structuredResponse is already typed as RegenerateResponse
      result = {
        title: structuredResponse.title,
        content: structuredResponse.content,
        changesSummary: structuredResponse.changesSummary,
        modelName: REGENERATOR_MODEL,
        latencyMs,
      };

      // For token usage, we need to invoke again with the original LLM
      // or use the response from structuredLLM if it contains usage metadata
      response = structuredResponse;
    } catch (error) {
      this.logger.warn(
        'Structured output failed, falling back to text parsing',
        error,
      );

      // Fallback to original text parsing
      response = await this.llm.invoke(prompt, config);
      const latencyMs = Date.now() - startTime;

      const text = this.extractMessageText(response?.content ?? '');
      result = this.parseResponse(text);
      result.modelName = REGENERATOR_MODEL;
      result.latencyMs = latencyMs;
    }

    // Extract token usage information from AIMessage's usage_metadata
    const usageMetadata = (response as any)?.usage_metadata;

    if (usageMetadata) {
      // The metadata contains both snake_case (LangChain format) and camelCase (Vertex AI format)
      // We can use either format, but let's prefer the original Vertex AI format for clarity
      result.promptTokens =
        usageMetadata.promptTokenCount || usageMetadata.input_tokens;
      result.completionTokens =
        usageMetadata.candidatesTokenCount || usageMetadata.output_tokens;
      result.totalTokens =
        usageMetadata.totalTokenCount || usageMetadata.total_tokens;

      // If we don't have totalTokens but have the components, calculate it
      if (
        !result.totalTokens &&
        result.promptTokens &&
        result.completionTokens
      ) {
        result.totalTokens = result.promptTokens + result.completionTokens;
      }

      this.logger.debug('Extracted token counts from usage_metadata:', {
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        raw_metadata: usageMetadata,
      });
    } else {
      this.logger.warn('No token usage data found in response.usage_metadata');
    }

    // Estimate cost for Gemini 2.5 Flash Lite
    if (result.promptTokens && result.completionTokens) {
      // Gemini 2.5 Flash Lite pricing (as of late 2024):
      // Input: $0.0375 per 1M tokens (50% cheaper than 1.5 Flash)
      // Output: $0.15 per 1M tokens (50% cheaper than 1.5 Flash)
      const inputCost = ((result.promptTokens || 0) * 0.0375) / 1_000_000;
      const outputCost = ((result.completionTokens || 0) * 0.15) / 1_000_000;
      result.costUsd = inputCost + outputCost;
    }

    this.logger.log(
      `Article regeneration completed - Tokens: ${result.totalTokens}, Latency: ${result.latencyMs}ms, Cost: $${result.costUsd?.toFixed(4)}`,
    );

    return result;
  }

  private async buildPrompt(input: RegenerateArticleInput): Promise<string> {
    const sections: string[] = [];

    sections.push('# Article Regeneration Task');
    sections.push('\n당신은 전문 콘텐츠 에디터입니다. 기존 아티클을 사용자의 요청에 따라 수정해야 합니다.');
    sections.push('\n## Current Article');
    sections.push(`\n### Title\n${input.previousTitle}`);
    sections.push(`\n### Content\n${input.previousContent}`);

    sections.push("\n## User's Modification Request");
    sections.push(`\n${input.userPrompt}`);

    if (input.conversationHistory && input.conversationHistory.length > 0) {
      sections.push('\n## Conversation History');
      sections.push('\n이전 대화 내역입니다. 사용자와의 대화 맥락을 이해하고 일관성 있게 응답해주세요:');
      sections.push('\n```');
      input.conversationHistory.forEach((msg, index) => {
        const roleLabel = msg.role === 'user' ? '사용자' : msg.role === 'assistant' ? 'AI' : '시스템';
        sections.push(`\n[${roleLabel}]: ${msg.content}`);
        if (index < input.conversationHistory!.length - 1) {
          sections.push('');
        }
      });
      sections.push('\n```');
    }

    if (input.topic || input.keyInsight) {
      sections.push('\n## Updated Parameters');
      if (input.topic) {
        sections.push(`\n**New Topic**: ${input.topic}`);
      }
      if (input.keyInsight) {
        sections.push(`\n**New Key Insight**: ${input.keyInsight}`);
      }
    }

    if (input.removedScraps && input.removedScraps.length > 0) {
      sections.push('\n## ⚠️ Removed Reference Materials');
      sections.push('\n아래 자료들은 이번 수정에서 **제거되었습니다**. 이 자료에 대한 언급이나 인용을 본문에서 삭제하거나 최소화하세요:');
      input.removedScraps.forEach((scrap, index) => {
        sections.push(`\n### 제거됨 ${index + 1}: ${scrap.title ?? 'Untitled'}`);
        sections.push(`**URL**: ${scrap.url ?? 'N/A'}`);
        if (scrap.userComment) {
          sections.push(`**제거 이유/메모**: ${scrap.userComment}`);
        }
        const content = scrap.content ?? '';
        const preview =
          content.length > 300 ? `${content.slice(0, 300)}...` : content;
        sections.push(`**내용 미리보기**: ${preview}`);
      });
    }

    if (input.addedScraps && input.addedScraps.length > 0) {
      sections.push('\n## ✅ 새로 추가된 Reference Materials');
      sections.push('\n아래 자료들은 이번 수정에서 **새로 추가되었습니다**. 이 자료를 본문에 자연스럽게 통합하세요:');
      const formatted = await this.formatScraps(input.addedScraps);
      sections.push(`\n${formatted}`);
    }

    if (input.existingScraps && input.existingScraps.length > 0) {
      sections.push('\n## 📚 기존 Reference Materials');
      sections.push('\n아래 자료들은 원본 아티클에 이미 포함되어 있던 자료입니다. 필요에 따라 계속 활용하세요:');
      const formatted = await this.formatScraps(input.existingScraps);
      sections.push(`\n${formatted}`);
    }

    if (
      (!input.existingScraps || input.existingScraps.length === 0) &&
      (!input.addedScraps || input.addedScraps.length === 0) &&
      (!input.removedScraps || input.removedScraps.length === 0) &&
      input.additionalScraps &&
      input.additionalScraps.length > 0
    ) {
      sections.push('\n## Additional Reference Materials (Scraps)');
      const formatted = await this.formatScraps(input.additionalScraps);
      sections.push(`\n${formatted}`);
    }

    if (input.additionalPdfs && input.additionalPdfs.length > 0) {
      sections.push('\n## Additional Reference Materials (PDFs)');
      input.additionalPdfs.forEach((pdf, index) => {
        sections.push(`\n### PDF ${index + 1}`);
        sections.push(`**Usage Instructions**: ${pdf.usagePrompt ?? ''}`);
        if (pdf.aiContent) {
          sections.push(`\n**Content**:\n${pdf.aiContent}`);
        }
      });
    }

    if (input.writingStyleExamples && input.writingStyleExamples.length > 0) {
      sections.push('\n## Writing Style Reference');
      sections.push('\n다음 예시 텍스트들의 문체와 톤을 따라주세요:');
      input.writingStyleExamples.forEach((example, index) => {
        sections.push(`\n### Example ${index + 1}\n${example}`);
      });
    }

    if (input.generationParams) {
      sections.push('\n## Additional Parameters');
      sections.push(`\n${input.generationParams}`);
    }

    sections.push('\n## Output Format');
    sections.push('\nJSON 형식으로 다음 필드를 포함하여 응답해주세요:');
    sections.push('\n```json');
    sections.push('{');
    sections.push('  "title": "수정된 아티클 제목",');
    sections.push('  "content": "수정된 본문 내용 (마크다운 형식)",');
    sections.push('  "changesSummary": "변경사항 요약 (구체적으로 무엇이 바뀌었는지 설명)"');
    sections.push('}');
    sections.push('```');

    sections.push('\n## Important Guidelines');
    sections.push('\n1. **기존 콘텐츠를 기반으로 수정**: 처음부터 다시 쓰지 말고, 기존 내용을 수정하세요');
    sections.push('2. **요청사항만 반영**: 사용자가 요청한 부분만 변경하세요');
    sections.push('3. **추가 자료 활용**: 제공된 새로운 스크랩이나 PDF 내용을 적절히 통합하세요');
    sections.push('4. **일관성 유지**: 전체적인 톤과 구조는 유지하면서 수정하세요');
    sections.push('5. **명확한 변경사항**: CHANGES_SUMMARY에 구체적으로 무엇이 바뀌었는지 설명하세요');

    return sections.join('\n');
  }

  private async formatScraps(scraps: ScrapReference[]): Promise<string> {
    if (!scraps || scraps.length === 0) {
      return '';
    }

    const items: ScrapWithComment[] = scraps.map((scrap) => ({
      scrap: {
        id: scrap.id,
        title: scrap.title,
        url: scrap.url,
        content: scrap.content,
        userComment: scrap.userComment ?? undefined,
      },
      userComment: scrap.userComment ?? undefined,
    }));

    return this.scrapCombinationService.formatForAiPromptWithComments(items);
  }

  private extractMessageText(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .map((part) =>
          typeof part === 'string'
            ? part
            : typeof part === 'object' && part !== null && 'text' in part
              ? String((part as { text?: unknown }).text ?? '')
              : '',
        )
        .join('');
    }
    if (content && typeof content === 'object' && 'content' in content) {
      return String((content as { content?: unknown }).content ?? '');
    }
    return String(content ?? '');
  }

  private parseResponse(text: string): RegenerateArticleOutput {
    const lines = text.split('\n');
    let section: 'title' | 'content' | 'summary' | null = null;
    const titleLines: string[] = [];
    const contentLines: string[] = [];
    const summaryLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('TITLE:')) {
        section = 'title';
        const remainder = line.replace('TITLE:', '').trim();
        if (remainder) {
          titleLines.push(remainder);
        }
        continue;
      }
      if (line.startsWith('CONTENT:')) {
        section = 'content';
        continue;
      }
      if (line.startsWith('CHANGES_SUMMARY:')) {
        section = 'summary';
        continue;
      }

      if (section === 'title') {
        titleLines.push(line.trim());
      } else if (section === 'content') {
        if (line.trim() !== '```') {
          contentLines.push(line);
        }
      } else if (section === 'summary') {
        if (line.trim() !== '```') {
          summaryLines.push(line);
        }
      }
    }

    const title = titleLines.join(' ').trim() || 'Regenerated Article';
    const content = contentLines.join('\n').trim() || text;
    const changesSummary =
      summaryLines.join('\n').trim() ||
      'Article has been regenerated based on your request.';

    return { title, content, changesSummary };
  }
}
