/**
 * 지원하는 콘텐츠 포맷 목록
 */
export enum ContentFormat {
  BLOG = 'blog',
  TWITTER = 'twitter',
  LINKEDIN = 'linkedin',
  INSTAGRAM = 'instagram',
  YOUTUBE = 'youtube',
  TIKTOK = 'tiktok',
  EMAIL = 'email',
  PODCAST = 'podcast',
  CUSTOM = 'custom',
}

/**
 * 익스포트 대상 플랫폼
 */
export enum ExportDestination {
  CLIPBOARD = 'clipboard',
  ZIP = 'zip',
  NOTION = 'notion',
  GOOGLE_DOCS = 'google_docs',
  BUFFER = 'buffer',
  HOOTSUITE = 'hootsuite',
  ZAPIER = 'zapier',
}

/**
 * 리퍼포징 작업 상태
 */
export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}
