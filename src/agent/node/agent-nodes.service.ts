import { Injectable } from '@nestjs/common';
import { NewsletterAgentService, AgentPersona, MultiAgentInput } from '../newsletter-agent.service';
import { NewsletterStateAnnotation } from '../newsletter-workflow.service';

/**
 * 에이전트 관련 노드들을 처리하는 서비스
 * 
 * @description 뉴스레터 생성 워크플로우에서 멀티 에이전트 실행과 결과 종합을 담당합니다.
 */
@Injectable()
export class AgentNodesService {
  constructor(
    private readonly agentService: NewsletterAgentService,
  ) {}

  /**
   * 멀티 에이전트 생성 노드
   * @param state 현재 워크플로우 상태
   * @returns 멀티 에이전트 실행 결과
   */
  async executeMultiAgentGeneration(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    const processingSteps = [...(state.processingSteps || []), 'multi_agent_execution'];
    const reasoning = [...(state.reasoning || [])];
    
    try {
      console.log('🤖 멀티 에이전트 시스템 실행');
      
      const agentInput: MultiAgentInput = {
        topic: state.topic,
        keyInsight: state.keyInsight,
        newsletterType: state.newsletterType || 'curation',
        scrapContent: state.scrapContent,
        webSearchResults: state.webSearchResults,
        factCheckResults: state.factCheckResults,
        keywordResults: state.keywordResults,
      };

      // 모든 에이전트를 병렬로 실행
      const agentResults = await this.agentService.executeAllAgents(agentInput);
      
      reasoning.push('멀티 에이전트 시스템 활성화: 4개 전문가 에이전트 병렬 실행 완료');

      return {
        writerOutput: agentResults.find(r => r.agentType === AgentPersona.WRITER)?.output,
        editorOutput: agentResults.find(r => r.agentType === AgentPersona.EDITOR)?.output,
        reviewerOutput: agentResults.find(r => r.agentType === AgentPersona.REVIEWER)?.output,
        strategistOutput: agentResults.find(r => r.agentType === AgentPersona.STRATEGIST)?.output,
        processingSteps,
        reasoning,
        selfCorrectionAttempts: 0,
      };
    } catch (error) {
      console.error('멀티 에이전트 실행 오류:', error);
      return {
        error: '멀티 에이전트 실행 중 오류가 발생했습니다.',
        processingSteps,
        reasoning,
      };
    }
  }

  /**
   * 에이전트 결과 종합 노드
   * @param state 현재 워크플로우 상태
   * @returns 에이전트 결과 종합 결과
   */
  async synthesizeAgentOutputs(state: typeof NewsletterStateAnnotation.State): Promise<any> {
    const processingSteps = [...(state.processingSteps || []), 'multi_agent_synthesis'];
    const reasoning = [...(state.reasoning || [])];
    
    try {
      // 에이전트 결과 수집
      const agentResults = [
        { agentType: AgentPersona.WRITER, output: state.writerOutput || '', processingTime: 0, confidence: 85 },
        { agentType: AgentPersona.EDITOR, output: state.editorOutput || '', processingTime: 0, confidence: 90 },
        { agentType: AgentPersona.REVIEWER, output: state.reviewerOutput || '', processingTime: 0, confidence: 80 },
        { agentType: AgentPersona.STRATEGIST, output: state.strategistOutput || '', processingTime: 0, confidence: 88 },
      ];

      // 에이전트 서비스를 통해 결과 종합
      const synthesisResult = await this.agentService.synthesizeAgentResults(agentResults);
      
      reasoning.push('멀티 에이전트 결과 종합 완료');

      return {
        title: synthesisResult.title,
        content: synthesisResult.content,
        draftTitle: synthesisResult.title,
        draftContent: synthesisResult.content,
        processingSteps,
        reasoning,
      };
    } catch (error) {
      console.error('멀티 에이전트 종합 오류:', error);
      return {
        error: '멀티 에이전트 결과 종합 중 오류가 발생했습니다.',
        processingSteps,
        reasoning,
      };
    }
  }
} 