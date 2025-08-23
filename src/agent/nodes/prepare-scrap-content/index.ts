import { Logger } from '@nestjs/common';
import { NewsletterStateAnnotation, NodeResult } from '../../types';
import { ScrapCombinationService } from '../../scrap-combination.service';

/**
 * 스크랩 콘텐츠 준비 노드
 * 스크랩 데이터를 AI 프롬프트에 사용할 수 있는 형태로 변환
 */
export class PrepareScrapContentNode {
  private readonly logger = new Logger('PrepareScrapContentNode');

  constructor(
    private readonly scrapCombinationService: ScrapCombinationService,
  ) {}

  async execute(
    state: typeof NewsletterStateAnnotation.State,
  ): Promise<NodeResult> {
    const processingSteps = [
      ...(state.processingSteps || []),
      'scrap_content_preparation',
    ];

    try {
      // 스크랩 데이터가 없는 경우 처리
      if (!state.scrapsWithComments?.length) {
        this.logger.warn('No scrap data provided');
        return {
          processingSteps,
          warnings: [
            ...(state.warnings || []),
            '스크랩 데이터가 제공되지 않았습니다.',
          ],
          scrapContent: '스크랩 데이터 없음. 주제와 핵심 인사이트만으로 진행합니다.',
        };
      }

      this.logger.log(`Preparing ${state.scrapsWithComments.length} scraps for AI processing`);

      // 스크랩 데이터를 AI 프롬프트 형식으로 변환
      const scrapContent = await this.scrapCombinationService.formatForAiPromptWithComments(
        state.scrapsWithComments,
      );

      this.logger.log('Scrap content prepared successfully');

      return {
        scrapContent,
        processingSteps,
      };
    } catch (error) {
      this.logger.error('Error preparing scrap content:', error);
      
      return {
        processingSteps,
        errors: [
          ...(state.errors || []),
          '스크랩 데이터를 준비하는 중 오류가 발생했습니다.',
        ],
        scrapContent: '스크랩 데이터 처리 실패. 기본 템플릿으로 진행합니다.',
      };
    }
  }
}