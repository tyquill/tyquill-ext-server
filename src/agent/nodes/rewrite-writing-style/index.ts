import { Logger } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { NewsletterStateAnnotation, NodeResult } from '../../types';
import { NewsletterPromptTemplatesService } from '../../newsletter-prompt-templates.service';

/**
 * 글쓰기 스타일 재작성 노드
 * 사용자의 글쓰기 스타일에 맞게 뉴스레터를 재작성
 */
export class RewriteWritingStyleNode {
  private readonly logger = new Logger('RewriteWritingStyleNode');

  constructor(
    private readonly rewriteModel: ChatGoogleGenerativeAI,
    private readonly promptTemplatesService: NewsletterPromptTemplatesService,
  ) {}

  async execute(
    state: typeof NewsletterStateAnnotation.State,
  ): Promise<NodeResult> {
    try {
      // 글쓰기 스타일 예시가 없으면 스킵
      if (!state.writingStyleExampleContents?.length) {
        this.logger.log('No writing style examples provided, skipping rewrite');
        return {};
      }

      this.logger.log('✍️ Rewriting with user writing style');

      // 재작성 템플릿 가져오기
      const template = this.promptTemplatesService.getWritingStyleRewriteTemplate();
      const chain = template.pipe(this.rewriteModel).pipe(new StringOutputParser());

      // 스타일에 맞게 재작성
      const result = await chain.invoke({
        content: state.content,
        writingStyleExampleContents: state.writingStyleExampleContents.join('\n\n---\n\n'),
      });

      this.logger.log('Writing style rewrite completed');

      return {
        content: result,
        processingSteps: [
          ...(state.processingSteps || []),
          'writing_style_rewrite',
        ],
      };
    } catch (error) {
      this.logger.error('Writing style rewrite error:', error);
      
      return {
        warnings: [
          ...(state.warnings || []),
          '글쓰기 스타일 재작성 중 오류가 발생했습니다. 원본 콘텐츠를 사용합니다.',
        ],
      };
    }
  }
}