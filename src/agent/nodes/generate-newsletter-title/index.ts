import { Logger } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { NewsletterStateAnnotation, NodeResult } from '../../types';
import { NewsletterPromptTemplatesService } from '../../newsletter-prompt-templates.service';

/**
 * 뉴스레터 제목 생성 노드
 * 생성된 뉴스레터 콘텐츠를 기반으로 제목 생성
 */
export class GenerateNewsletterTitleNode {
  private readonly logger = new Logger('GenerateNewsletterTitleNode');

  constructor(
    private readonly titleModel: ChatGoogleGenerativeAI,
    private readonly promptTemplatesService: NewsletterPromptTemplatesService,
  ) {}

  async execute(
    state: typeof NewsletterStateAnnotation.State,
  ): Promise<NodeResult> {
    try {
      this.logger.log('📝 Generating newsletter title');

      // 제목 생성 템플릿 가져오기
      const template = this.promptTemplatesService.getSimpleNewsletterTitleTemplate();
      const chain = template.pipe(this.titleModel).pipe(new StringOutputParser());

      // 제목 생성
      const result = await chain.invoke({
        topic: state.topic,
        keyInsight: state.keyInsight || '없음',
        generationParams: state.generationParams || '없음',
        content: state.content,
      });

      this.logger.log('Title generated successfully');

      return {
        title: result.trim(),
      };
    } catch (error) {
      this.logger.error('Title generation error:', error);
      
      // 에러 발생 시 기본 제목 사용
      return {
        title: `${state.topic} 뉴스레터`,
        warnings: [
          ...(state.warnings || []),
          '제목 생성에 실패하여 기본 제목을 사용합니다.',
        ],
      };
    }
  }
}