import { Injectable, Logger } from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableLambda, RunnableSequence } from '@langchain/core/runnables';
import { ChatVertexAI } from '@langchain/google-vertexai';

import { ScrapWithComment } from '../dto/newsletter.dto';
import { VertexAiFactory } from './vertex-ai.factory';

const SCRAP_MODEL = 'gemini-2.5-flash-lite';

@Injectable()
export class ScrapCombinationService {
  private readonly logger = new Logger(ScrapCombinationService.name);
  private readonly summaryModel: ChatVertexAI;
  private readonly contentSummaryTemplate: PromptTemplate;
  private readonly summaryChain: RunnableSequence<
    Record<string, unknown>,
    string
  >;

  constructor(private readonly vertexFactory: VertexAiFactory) {
    this.summaryModel = this.vertexFactory.buildChat({
      model: SCRAP_MODEL,
      temperature: 0.7,
      thinkingBudget: 0,
      maxOutputTokens: 2048,
    });
    this.contentSummaryTemplate = PromptTemplate.fromTemplate(`
<role>
You are an expert content analyst who creates comprehensive yet concise summaries for newsletter generation.
</role>

<task>
Create a high-quality summary that captures the essence and key insights of the content.
{user_comment_instruction}
</task>

Original Content:
{content}

{user_comment_context}

<output_requirements>
- Length: 3-5 sentences capturing the core message
- Focus: Main thesis, key arguments, and actionable insights
- Style: Clear, factual, and information-dense
- Structure: Start with main point, then supporting details
</output_requirements>

<analysis_priorities>
1. MAIN POINT: What is the central message or finding?
2. KEY INSIGHTS: What are the 2-3 most important takeaways?
3. EVIDENCE: What data, examples, or arguments support the main point?
4. RELEVANCE: Why does this matter to readers?
5. TECHNICAL DETAILS: Preserve important technical terms, numbers, and specifics
{user_comment_priority}
</analysis_priorities>

<quality_criteria>
- Include ALL critical information (names, numbers, technical terms)
- Maintain factual accuracy without interpretation
- Use active voice and strong verbs
- Avoid generic phrases like "this article discusses"
- Preserve cause-effect relationships and logical flow
{user_comment_criteria}
</quality_criteria>`);

    // Create a RunnableLambda wrapper to handle the PromptValue -> string conversion
    // and invoke the ChatVertexAI model
    const llmRunnable = RunnableLambda.from(async (input: any) => {
      // The PromptTemplate outputs a BasePromptValue, which our ChatVertexAI can now handle
      const response = await this.summaryModel.invoke(input);
      return response;
    });

    // Chain: PromptTemplate -> LLM wrapper -> StringOutputParser
    this.summaryChain = RunnableSequence.from([
      this.contentSummaryTemplate,
      llmRunnable,
      new StringOutputParser(),
    ]);
  }

  private summaryModelExtractText(response: unknown): string {
    if (typeof response === 'string') {
      return response;
    }
    if (
      response &&
      typeof response === 'object' &&
      'content' in response
    ) {
      const content = (response as { content?: unknown }).content;
      if (typeof content === 'string') {
        return content;
      }
      if (Array.isArray(content)) {
        return content
          .map((part) => {
            if (!part) return '';
            if (typeof part === 'string') return part;
            if (typeof part === 'object' && 'text' in part) {
              return String((part as { text?: unknown }).text ?? '');
            }
            if (typeof part === 'object' && 'content' in part) {
              return String((part as { content?: unknown }).content ?? '');
            }
            return '';
          })
          .join('');
      }
    }
    return String(response ?? '');
  }

  private truncateContent(content: string): string {
    if (!content) {
      return '';
    }

    if (content.length <= 4000) {
      return content;
    }

    const truncated = content.slice(0, 4000);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastNewline = truncated.lastIndexOf('\n');
    const cutoff = Math.max(lastPeriod, lastNewline);

    if (cutoff > 3200) {
      return `${truncated.slice(0, cutoff + 1)}...[content truncated]`;
    }

    return `${truncated}...[content truncated]`;
  }

  private buildUserCommentSections(userComment?: string | null): {
    instruction: string;
    context: string;
    priority: string;
    criteria: string;
  } {
    if (!userComment) {
      return {
        instruction: '',
        context: '',
        priority: '',
        criteria: '',
      };
    }

    return {
      instruction: `Pay special attention to the user's note about this content.
The user has indicated specific interest or context that should guide your summary.`,
      context: `User's Note About This Content:
"${userComment}"

This note indicates what the user found important or relevant about this content.
Your summary should emphasize aspects related to this note.`,
      priority: `
6. USER FOCUS: Prioritize information related to the user's note
7. CONTEXT ALIGNMENT: Ensure the summary addresses the user's indicated interest`,
      criteria: `
- Give priority to content that relates to the user's note
- Highlight connections to the user's stated interest or concern`,
    };
  }

  private async createSummary(
    scrap: ScrapWithComment,
  ): Promise<{ summary: string; hasUserComment: boolean }> {
    const content = scrap.scrap.content ?? '';
    if (content.trim().length < 100) {
      return {
        summary: content.trim(),
        hasUserComment: Boolean(scrap.userComment ?? scrap.scrap.userComment),
      };
    }

    const truncatedContent = this.truncateContent(content);
    const userNote = scrap.userComment ?? scrap.scrap.userComment;
    const userSections = this.buildUserCommentSections(userNote);

    try {
      const summary = await this.summaryChain.invoke({
        content: truncatedContent,
        user_comment_instruction: userSections.instruction,
        user_comment_context: userSections.context,
        user_comment_priority: userSections.priority,
        user_comment_criteria: userSections.criteria,
      });

      const cleaned = summary.trim().replace(/^summary:\s*/i, '');

      return { summary: cleaned, hasUserComment: Boolean(userNote) };
    } catch (error) {
      this.logger.error('Failed to build AI summary', error as Error);
      const fallback = truncatedContent.split('\n\n')[0]?.slice(0, 500) ?? '';
      return {
        summary: fallback.endsWith('...') ? fallback : `${fallback}...`,
        hasUserComment: Boolean(userNote),
      };
    }
  }

  private buildPromptSections(
    entries: Array<{
      scrap: ScrapWithComment;
      summary: string;
      hasUserComment: boolean;
    }>,
  ): string {
    const lines: string[] = [];

    if (entries.length > 1) {
      const commentedCount = entries.filter(
        (item) => item.hasUserComment,
      ).length;
      lines.push('=== CONTENT OVERVIEW ===');
      lines.push(`Total Sources: ${entries.length} articles`);
      if (commentedCount > 0) {
        lines.push(
          `Editorial Notes: ${commentedCount} sources have user insights`,
        );
      }
      lines.push('');
    }

    entries.forEach(({ scrap, summary }, index) => {
      const base = scrap.scrap;
      lines.push(`=== SOURCE #${index + 1} ===`);
      lines.push(`Title: ${base.title}`);
      lines.push(`URL: ${base.url}`);
      lines.push(`Original Length: ${base.content?.length ?? 0} chars`);
      if (scrap.userComment || base.userComment) {
        lines.push(
          `User Insight: ${scrap.userComment ?? base.userComment ?? ''}`.trim(),
        );
      }
      lines.push('');
      lines.push('Key Takeaways:');
      lines.push(summary);
      lines.push('');
    });

    return lines.join('\n');
  }

  async formatForAiPromptWithComments(
    scrapsWithComments: ScrapWithComment[],
  ): Promise<string> {
    if (!scrapsWithComments?.length) {
      return 'Scrap data is not provided. Proceed with the topic and key insight only.';
    }

    const summaries = await Promise.all(
      scrapsWithComments.map(async (item) => {
        const result = await this.createSummary(item);
        return {
          scrap: item,
          summary: result.summary,
          hasUserComment: result.hasUserComment,
        };
      }),
    );

    return this.buildPromptSections(summaries);
  }
}
