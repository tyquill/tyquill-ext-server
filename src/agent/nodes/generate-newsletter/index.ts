import { Logger } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { NewsletterStateAnnotation, NodeResult } from '../../types';
import { NewsletterPromptTemplatesService } from '../../newsletter-prompt-templates.service';

/**
 * 뉴스레터 생성 노드
 * AI를 사용하여 실제 뉴스레터 콘텐츠를 생성
 */
export class GenerateNewsletterNode {
  private readonly logger = new Logger('GenerateNewsletterNode');

  constructor(
    private readonly model: ChatGoogleGenerativeAI,
    private readonly promptTemplatesService: NewsletterPromptTemplatesService,
  ) {}

  async execute(
    state: typeof NewsletterStateAnnotation.State,
  ): Promise<NodeResult> {
    const processingSteps = [
      ...(state.processingSteps || []),
      'newsletter_generation',
    ];

    try {
      const iteration = (state.countOfReflector || 0) + 1;
      this.logger.log(`📝 Generating newsletter (iteration: ${iteration})`);

      // 프롬프트 템플릿 가져오기
      const template = this.promptTemplatesService.getSimpleNewsletterTemplate();
      const chain = template.pipe(this.model).pipe(new StringOutputParser());

      // 뉴스레터 생성
      const result = await chain.invoke({
        topic: state.topic,
        keyInsight: state.keyInsight || '없음',
        generationParams: state.generationParams || '없음',
        scrapContent: state.scrapContent || '없음',
        articleStructureTemplate: state.articleStructureTemplate || '없음',
        feedbacks: state.feedbacks?.length ? JSON.stringify(state.feedbacks) : '없음',
      });

      this.logger.log('Newsletter generated successfully');

      return {
        content: result,
        analysisReason: 'AI 모델로 생성된 뉴스레터입니다.',
        processingSteps,
        countOfReflector: iteration,
      };
    } catch (error) {
      this.logger.error('Newsletter generation error:', error);
      
      return {
        processingSteps,
        errors: [
          ...(state.errors || []),
          '뉴스레터 생성 중 오류가 발생했습니다.',
        ],
        content: `${state.topic}에 대한 기본 뉴스레터 내용입니다.`,
      };
    }
  }
}