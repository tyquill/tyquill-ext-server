export enum EventType {
  PROGRESS = 'progress',
  TOKEN = 'token',
  NODE_START = 'node_start',
  NODE_COMPLETE = 'node_complete',
  COMPLETE = 'complete',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
}

export enum NodeName {
  PREPARE_SCRAP = 'prepare_scrap_content',
  PROCESS_PDF = 'process_pdf_content',
  GENERATE_NEWSLETTER = 'generate_newsletter',
  GENERATE_TITLE = 'generate_newsletter_title',
  ARTICLE_REFLECTOR = 'article_reflector',
  REWRITE_STYLE = 'rewrite_writing_style',
  ADAPT_LOCALE = 'adapt_locale',
  AGGREGATOR = 'aggregator',
}

export interface BaseStreamEvent {
  type: EventType;
  timestamp: number;
}

export interface ProgressEvent extends BaseStreamEvent {
  type: EventType.PROGRESS;
  node: string;
  message_ko: string;
  message_en: string;
  progress: number;
  metadata?: Record<string, unknown>;
  warnings?: string[];
}

export interface TokenEvent extends BaseStreamEvent {
  type: EventType.TOKEN;
  content: string;
  node: string;
  is_final?: boolean;
}

export interface NodeStartEvent extends BaseStreamEvent {
  type: EventType.NODE_START;
  node: string;
  message_ko: string;
  message_en: string;
  metadata?: Record<string, unknown>;
}

export interface NodeCompleteEvent extends BaseStreamEvent {
  type: EventType.NODE_COMPLETE;
  node: string;
  result?: Record<string, unknown>;
  duration: number;
  message?: string;
}

export interface CompleteEvent extends BaseStreamEvent {
  type: EventType.COMPLETE;
  title: string;
  content: string;
  analysis_reason: string;
  warnings: string[];
  total_duration: number;
  metadata?: Record<string, unknown>;
}

export interface ErrorEvent extends BaseStreamEvent {
  type: EventType.ERROR;
  message: string;
  node?: string;
  error_type: string;
  traceback?: string;
}

export interface HeartbeatEvent extends BaseStreamEvent {
  type: EventType.HEARTBEAT;
  message: string;
}

export type StreamEvent =
  | ProgressEvent
  | TokenEvent
  | NodeStartEvent
  | NodeCompleteEvent
  | CompleteEvent
  | ErrorEvent
  | HeartbeatEvent;

export const NODE_MESSAGES: Record<
  NodeName,
  {
    start_ko: string;
    start_en: string;
    complete_ko: string;
    complete_en: string;
    iteration_ko?: string;
    iteration_en?: string;
  }
> = {
  [NodeName.PREPARE_SCRAP]: {
    start_ko: '웹 스크랩 데이터 준비 중...',
    start_en: 'Preparing web scrap data...',
    complete_ko: '웹 스크랩 데이터 준비 완료',
    complete_en: 'Web scrap data prepared',
  },
  [NodeName.PROCESS_PDF]: {
    start_ko: 'PDF 문서 분석 중...',
    start_en: 'Analyzing PDF documents...',
    complete_ko: 'PDF 문서 분석 완료',
    complete_en: 'PDF documents analyzed',
  },
  [NodeName.AGGREGATOR]: {
    start_ko: '콘텐츠 집계 중...',
    start_en: 'Aggregating content...',
    complete_ko: '콘텐츠 집계 완료',
    complete_en: 'Content aggregated',
  },
  [NodeName.GENERATE_NEWSLETTER]: {
    start_ko: '뉴스레터 초안 생성 중...',
    start_en: 'Generating newsletter draft...',
    complete_ko: '뉴스레터 초안 생성 완료',
    complete_en: 'Newsletter draft generated',
    iteration_ko: '뉴스레터 품질 개선 중... (반복 {}회)',
    iteration_en: 'Improving newsletter quality... (iteration {})',
  },
  [NodeName.ARTICLE_REFLECTOR]: {
    start_ko: '콘텐츠 품질 평가 중...',
    start_en: 'Evaluating content quality...',
    complete_ko: '콘텐츠 품질 평가 완료',
    complete_en: 'Content quality evaluated',
  },
  [NodeName.REWRITE_STYLE]: {
    start_ko: '작성 스타일 적용 중...',
    start_en: 'Applying writing style...',
    complete_ko: '작성 스타일 적용 완료',
    complete_en: 'Writing style applied',
  },
  [NodeName.GENERATE_TITLE]: {
    start_ko: '제목 생성 중...',
    start_en: 'Generating title...',
    complete_ko: '제목 생성 완료',
    complete_en: 'Title generated',
  },
  [NodeName.ADAPT_LOCALE]: {
    start_ko: '언어 최적화 중...',
    start_en: 'Optimizing language...',
    complete_ko: '언어 최적화 완료',
    complete_en: 'Language optimized',
  },
};

