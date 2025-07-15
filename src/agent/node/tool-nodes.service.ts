import { Injectable } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { NewsletterToolsService, ToolResult } from '../newsletter-tools.service';
import { NewsletterPromptTemplatesService } from '../newsletter-prompt-templates.service';
import { ScrapWithComment } from '../scrap-combination.service';
import { NewsletterStateAnnotation } from '../newsletter-workflow.service';

/**
 * 도구 관련 노드들을 처리하는 서비스
 * 
 * @description 뉴스레터 생성 워크플로우에서 도구의 필요성 평가, 실행, 결과 통합을 담당합니다.
 */
@Injectable()
export class ToolNodesService {
  private readonly strategistModel: ChatGoogleGenerativeAI;

  constructor(
    private readonly toolsService: NewsletterToolsService,
    private readonly promptTemplatesService: NewsletterPromptTemplatesService,
  ) {
    this.strategistModel = new ChatGoogleGenerativeAI({
      model: 'gemini-1.5-pro',
      temperature: 0.7,
      maxOutputTokens: 2048,
    });
  }

  /**
   * 도구 필요성 평가 노드
   * @param state 현재 워크플로우 상태
   * @returns 도구 필요성 평가 결과
   */
  async assessToolNeeds(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    const processingSteps = [...(state.processingSteps || []), 'tool_needs_assessment'];
    const reasoning = [...(state.reasoning || [])];
    
    try {
      const assessmentTemplate = this.promptTemplatesService.getToolEnabledTemplate();
      const chain = assessmentTemplate.pipe(this.strategistModel).pipe(new StringOutputParser());
      
      const result = await chain.invoke({
        topic: state.topic,
        keyInsight: state.keyInsight || '없음',
        newsletterType: state.newsletterType || 'unknown',
        generationParams: state.generationParams || '없음',
        scrapContent: state.scrapContent || '스크랩 데이터 없음',
      });

      // 결과 파싱 - 단순화된 로직
      const needsTools = result.toLowerCase().includes('도구') || result.toLowerCase().includes('tool');
      const recommendedTools = needsTools ? ['web_search', 'fact_check'] : [];

      reasoning.push(`도구 필요성 평가: ${needsTools ? 'YES' : 'NO'}`);
      if (recommendedTools.length > 0) {
        reasoning.push(`권장 도구: ${recommendedTools.join(', ')}`);
      }

      return {
        needsTools,
        recommendedTools,
        processingSteps,
        reasoning,
      };
    } catch (error) {
      console.error('도구 필요성 평가 오류:', error);
      return {
        error: '도구 필요성 평가 중 오류가 발생했습니다.',
        processingSteps,
        reasoning,
        needsTools: false,
        recommendedTools: [],
      };
    }
  }

  /**
   * 도구 실행 노드
   * @param state 현재 워크플로우 상태
   * @returns 도구 실행 결과
   */
  async executeTools(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    const processingSteps = [...(state.processingSteps || []), 'tools_execution'];
    const reasoning = [...(state.reasoning || [])];
    
    try {
      const recommendedTools = state.recommendedTools || [];
      
      if (recommendedTools.length === 0) {
        reasoning.push('권장된 도구가 없어 도구 실행을 건너뜁니다.');
        return {
          processingSteps,
          reasoning,
          toolResults: [],
        };
      }

      reasoning.push(`${recommendedTools.length}개 도구 실행 시작`);

      // 도구별 입력 준비
      const toolRequests = recommendedTools.map((toolName: string) => {
        let input: string;
        
        switch (toolName) {
          case 'web_search':
          case 'analyze_trends':
          case 'competitor_analysis':
            input = state.topic;
            break;
          case 'fact_check':
            input = state.keyInsight || state.topic;
            break;
          case 'sentiment_analysis':
          case 'extract_keywords':
          case 'generate_image_description':
            input = state.scrapContent || state.topic;
            break;
          case 'extract_url_content':
            const urls = state.scrapsWithComments?.map(sc => sc.scrap.url).filter(url => url) || [];
            input = urls.length > 0 ? urls[0] : 'https://example.com';
            break;
          default:
            input = state.topic;
        }

        return { toolName, input };
      });

      // 도구 서비스를 통해 병렬 실행
      const toolResults = await this.toolsService.executeToolsParallel(toolRequests);

      const successfulTools = toolResults.filter(r => r.success).length;
      reasoning.push(`도구 실행 완료: ${successfulTools}/${toolResults.length} 성공`);

      // 각 도구별 결과를 상태에 저장
      const webSearchResult = toolResults.find(r => r.toolName === 'web_search');
      const urlContentResult = toolResults.find(r => r.toolName === 'extract_url_content');
      const keywordResult = toolResults.find(r => r.toolName === 'extract_keywords');
      const factCheckResult = toolResults.find(r => r.toolName === 'fact_check');

      return {
        toolResults,
        webSearchResults: webSearchResult?.output,
        urlContentResults: urlContentResult?.output,
        keywordResults: keywordResult?.output ? [keywordResult.output] : [],
        factCheckResults: factCheckResult?.output,
        processingSteps,
        reasoning,
      };
    } catch (error) {
      console.error('도구 실행 오류:', error);
      return {
        error: '도구 실행 중 오류가 발생했습니다.',
        processingSteps,
        reasoning,
        toolResults: [],
      };
    }
  }

  /**
   * 도구 결과 통합 노드
   * @param state 현재 워크플로우 상태
   * @returns 도구 결과 통합 결과
   */
  async integrateToolResults(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    const processingSteps = [...(state.processingSteps || []), 'tool_results_integration'];
    const reasoning = [...(state.reasoning || [])];
    
    try {
      const toolResults = state.toolResults || [];
      
      if (toolResults.length === 0) {
        reasoning.push('통합할 도구 결과가 없습니다.');
        return {
          processingSteps,
          reasoning,
        };
      }

      // 도구 결과를 스크랩 콘텐츠에 통합
      let enhancedScrapContent = state.scrapContent || '';
      
      enhancedScrapContent += '\n\n## 🔧 도구 분석 결과\n';
      
      toolResults.forEach((result, index) => {
        if (result.success) {
          enhancedScrapContent += `\n### ${index + 1}. ${result.toolName} 결과\n`;
          enhancedScrapContent += `${result.output}\n`;
        }
      });

      reasoning.push(`${toolResults.length}개 도구 결과를 스크랩 콘텐츠에 통합`);

      return {
        scrapContent: enhancedScrapContent,
        processingSteps,
        reasoning,
      };
    } catch (error) {
      console.error('도구 결과 통합 오류:', error);
      return {
        error: '도구 결과 통합 중 오류가 발생했습니다.',
        processingSteps,
        reasoning,
      };
    }
  }
} 