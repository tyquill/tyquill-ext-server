import { Logger } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { NewsletterStateAnnotation, NodeResult, Feedback } from '../../types';
import { NewsletterPromptTemplatesService } from '../../newsletter-prompt-templates.service';

/**
 * 아티클 리플렉터 노드
 * 생성된 뉴스레터의 품질을 평가하고 개선 피드백 제공
 */
export class ArticleReflectorNode {
  private readonly logger = new Logger('ArticleReflectorNode');

  constructor(
    private readonly reflectorModel: ChatGoogleGenerativeAI,
    private readonly promptTemplatesService: NewsletterPromptTemplatesService,
  ) {}

  async execute(
    state: typeof NewsletterStateAnnotation.State,
  ): Promise<NodeResult> {
    try {
      const iteration = state.countOfReflector || 0;
      this.logger.log(`🔍 Running article reflector (iteration: ${iteration})`);

      // 리플렉터 템플릿 가져오기
      const template = this.promptTemplatesService.getArticleReflectorTemplate();
      const chain = template.pipe(this.reflectorModel).pipe(new StringOutputParser());

      // 품질 평가 및 피드백 생성
      const result = await chain.invoke({
        topic: state.topic || '없음',
        keyInsight: state.keyInsight || '없음',
        generationParams: state.generationParams || '없음',
        content: state.content || '없음',
      });

      // 피드백 파싱
      let feedback: string;
      try {
        const parsedResult = JSON.parse(result);
        feedback = parsedResult.feedback || result;
      } catch {
        feedback = result;
      }

      this.logger.log('Article reflection completed');

      // 피드백 히스토리 업데이트
      const newFeedback: Feedback = {
        generatedNewsletter: state.content || '',
        feedback,
      };

      return {
        feedbacks: [...(state.feedbacks || []), newFeedback],
      };
    } catch (error) {
      this.logger.error('Article reflection error:', error);
      
      return {
        warnings: [
          ...(state.warnings || []),
          '품질 검토 중 오류가 발생했습니다.',
        ],
      };
    }
  }
}