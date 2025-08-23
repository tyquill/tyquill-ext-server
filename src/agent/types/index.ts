import { Annotation } from '@langchain/langgraph';
import { Scrap } from '../../scraps/entities/scrap.entity';
import { SectionTemplate } from '../../types/section-template';

/**
 * 스크랩과 코멘트 데이터
 */
export interface ScrapWithComment {
  scrap: Scrap;
  userComment?: string;
}

/**
 * 피드백 데이터 타입
 */
export interface Feedback {
  generatedNewsletter: string;
  feedback: string;
}

/**
 * 뉴스레터 워크플로우 상태 타입
 */
export const NewsletterStateAnnotation = Annotation.Root({
  // 입력 데이터
  topic: Annotation<string>,
  keyInsight: Annotation<string | undefined>,
  scrapsWithComments: Annotation<ScrapWithComment[]>,
  generationParams: Annotation<string | undefined>,
  articleStructureTemplate: Annotation<SectionTemplate[] | undefined>,
  writingStyleExampleContents: Annotation<string[] | undefined>,
  
  // 중간 처리 데이터
  scrapContent: Annotation<string>,
  countOfReflector: Annotation<number>,
  feedbacks: Annotation<Feedback[]>,
  
  // 최종 결과
  title: Annotation<string>,
  content: Annotation<string>,
  
  // 메타데이터
  processingSteps: Annotation<string[]>,
  warnings: Annotation<string[]>,
  errors: Annotation<string[]>,
});

/**
 * 뉴스레터 입력 데이터
 */
export interface NewsletterInput {
  topic: string;
  keyInsight?: string;
  scrapsWithComments: ScrapWithComment[];
  generationParams?: string;
  articleStructureTemplate?: SectionTemplate[];
  writingStyleExampleContents?: string[];
}

/**
 * 뉴스레터 출력 데이터
 */
export interface NewsletterOutput {
  title: string;
  content: string;
  analysisReason: string;
  warnings: string[];
}

/**
 * 노드 실행 결과 타입
 */
export interface NodeResult {
  [key: string]: any;
  processingSteps?: string[];
  warnings?: string[];
  errors?: string[];
}