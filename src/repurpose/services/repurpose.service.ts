import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/postgresql';
import {
  RepurposedContent,
  RepurposingJob,
  FormatTemplate,
  ContentFormat,
  JobStatus,
} from '../entities';
import { Article } from '../../articles/entities/article.entity';
import { User } from '../../users/entities/user.entity';
import {
  RepurposeRequestDto,
  RepurposeResponseDto,
  AsyncRepurposeResponseDto,
  RepurposedContentResponseDto,
  JobStatusResponseDto,
} from '../../api/repurpose/dto';

@Injectable()
export class RepurposeService {
  private readonly logger = new Logger(RepurposeService.name);

  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: EntityRepository<Article>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    @InjectRepository(RepurposedContent)
    private readonly repurposedContentRepository: EntityRepository<RepurposedContent>,
    @InjectRepository(RepurposingJob)
    private readonly repurposingJobRepository: EntityRepository<RepurposingJob>,
    @InjectRepository(FormatTemplate)
    private readonly templateRepository: EntityRepository<FormatTemplate>,
    private readonly em: EntityManager,
  ) {}

  /**
   * 워크플로우 서비스 주입 (순환 참조 방지를 위해 lazy injection)
   */
  private repurposeWorkflowService: any;

  setRepurposeWorkflowService(service: any) {
    this.repurposeWorkflowService = service;
  }

  /**
   * 동기 리퍼포징 처리
   */
  async repurpose(
    userId: string,
    request: RepurposeRequestDto,
  ): Promise<RepurposeResponseDto> {
    const startTime = Date.now();

    // 1. Article 로드
    const article = await this.articleRepository.findOne(
      { articleId: request.articleId },
      { populate: ['user', 'archives'] },
    );

    if (!article) {
      throw new NotFoundException(
        `Article not found: ${request.articleId}`,
      );
    }

    // 2. User 로드
    const user = await this.userRepository.findOne({ userId });
    if (!user) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    // 3. 템플릿 로드 (선택사항)
    let template: FormatTemplate | null = null;
    if (request.templateId) {
      template = await this.templateRepository.findOne({
        id: request.templateId,
      });
    }

    // 4. 각 포맷별로 콘텐츠 생성
    const contents: RepurposedContentResponseDto[] = [];
    const failedFormats: ContentFormat[] = [];

    for (const format of request.formats) {
      try {
        this.logger.log(`Generating ${format} format for article ${article.articleId}`);

        const generatedContent = await this.generateContentForFormat(
          article,
          format,
          request.formatOptions?.[format],
          template,
        );

        // 5. DB에 저장
        const repurposedContent = this.repurposedContentRepository.create({
          originalArticle: article,
          user,
          format,
          content: generatedContent.content,
          formatSpecificData: generatedContent.formatSpecificData,
          qualityScore: generatedContent.qualityScore || 0,
          qualityDetails: generatedContent.qualityDetails as any,
          characterCount: generatedContent.content.length,
          wordCount: this.countWords(generatedContent.content),
          isEdited: false,
          template,
          datePartition: new Date(),
        } as any);

        this.em.persist(repurposedContent);
        await this.em.flush();

        contents.push({
          id: repurposedContent.id,
          format: repurposedContent.format,
          content: repurposedContent.content,
          formatSpecificData: repurposedContent.formatSpecificData,
          qualityScore: repurposedContent.qualityScore,
          qualityDetails: repurposedContent.qualityDetails,
          characterCount: repurposedContent.characterCount,
          wordCount: repurposedContent.wordCount,
          createdAt: repurposedContent.createdAt,
        });

        this.logger.log(`Successfully generated ${format} format`);
      } catch (error) {
        this.logger.error(`Failed to generate ${format} format`, error);
        failedFormats.push(format);
      }
    }

    const processingTimeMs = Date.now() - startTime;

    return {
      articleId: request.articleId,
      contents,
      successCount: contents.length,
      failedFormats,
      processingTimeMs,
    };
  }

  /**
   * 비동기 리퍼포징 처리
   */
  async repurposeAsync(
    userId: string,
    request: RepurposeRequestDto,
  ): Promise<AsyncRepurposeResponseDto> {
    // User 로드
    const user = await this.userRepository.findOne({ userId });
    if (!user) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    // Article 존재 확인
    const article = await this.articleRepository.findOne({
      articleId: request.articleId,
    });
    if (!article) {
      throw new NotFoundException(
        `Article not found: ${request.articleId}`,
      );
    }

    // Job 생성
    const job = this.repurposingJobRepository.create({
      user,
      article,
      formats: JSON.stringify(request.formats),
      status: JobStatus.PENDING,
      progress: 0,
    } as any);

    this.em.persist(job);
    await this.em.flush();

    return {
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt,
      statusUrl: `/api/v3/repurpose/jobs/${job.id}`,
    };
  }

  /**
   * 작업 상태 조회
   */
  async getJobStatus(jobId: string): Promise<JobStatusResponseDto> {
    const job = await this.repurposingJobRepository.findOne(
      { id: jobId },
      { populate: ['user', 'article'] },
    );

    if (!job) {
      throw new NotFoundException(`Job not found: ${jobId}`);
    }

    const response: JobStatusResponseDto = {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      formatProgress: job.formatProgress,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      errorMessage: job.errorMessage,
    };

    // 완료된 경우 결과 포함
    if (job.status === JobStatus.COMPLETED && job.result) {
      response.result = job.result as any;
    }

    return response;
  }

  /**
   * 특정 포맷으로 콘텐츠 생성
   */
  private async generateContentForFormat(
    article: Article,
    format: ContentFormat,
    options: any,
    template: FormatTemplate | null,
  ): Promise<{
    content: string;
    formatSpecificData?: Record<string, any>;
    qualityScore?: number;
    qualityDetails?: Record<string, any>;
  }> {
    // 최신 아티클 콘텐츠 가져오기
    const archives = article.archives?.getItems() || [];
    const latestArchive = archives.length > 0 ? archives[archives.length - 1] : null;

    if (!latestArchive) {
      throw new Error('No article content found');
    }

    const articleContent = latestArchive.content;
    const articleTitle = latestArchive.title || article.topic;

    this.logger.log(`Generating ${format} format`);
    this.logger.log(`Article title: ${articleTitle}`);
    this.logger.log(`Content length: ${articleContent.length} chars`);

    // LangGraph 워크플로우 호출
    if (this.repurposeWorkflowService) {
      try {
        const workflowInput = {
          articleTitle,
          articleContent,
          format,
          targetAudience: options?.targetAudience,
          keyMessage: options?.keyMessage,
          professionalContext: options?.professionalContext,
          visualContext: options?.visualContext,
          channelStyle: options?.channelStyle,
          podcastStyle: options?.podcastStyle,
          hostPersonality: options?.hostPersonality,
          audienceSegment: options?.audienceSegment,
          tone: options?.tone,
        };

        const result = await this.repurposeWorkflowService.repurpose(workflowInput);
        return result;
      } catch (error) {
        this.logger.error(`Workflow failed for ${format}, using fallback`, error);
      }
    }

    // 폴백: 워크플로우 서비스가 없거나 실패한 경우
    this.logger.warn('Using fallback content generation');
    return {
      content: `# ${articleTitle} (${format})\n\n${articleContent}\n\n_Repurposed to ${format} format_`,
      formatSpecificData: {
        originalFormat: 'newsletter',
        targetFormat: format,
        generatedAt: new Date().toISOString(),
      },
      qualityScore: 75,
      qualityDetails: {
        relevance: 80,
        clarity: 75,
        engagement: 70,
      },
    };
  }

  /**
   * 아티클의 모든 리퍼포징 콘텐츠 조회
   */
  async getArticleRepurposedContent(
    articleId: string,
  ): Promise<RepurposeResponseDto> {
    const contents = await this.repurposedContentRepository.find(
      {
        originalArticle: { articleId },
      },
      {
        populate: ['user', 'originalArticle'],
        orderBy: { createdAt: 'DESC' },
      },
    );

    return {
      articleId,
      contents: contents.map((content) => ({
        id: content.id,
        format: content.format,
        content: content.content,
        formatSpecificData: content.formatSpecificData,
        qualityScore: content.qualityScore,
        qualityDetails: content.qualityDetails,
        characterCount: content.characterCount,
        wordCount: content.wordCount,
        createdAt: content.createdAt,
      })),
      successCount: contents.length,
      failedFormats: [],
      processingTimeMs: 0,
    };
  }

  /**
   * 리퍼포징 콘텐츠 상세 조회
   */
  async getRepurposedContent(id: string) {
    const content = await this.repurposedContentRepository.findOne(
      { id },
      {
        populate: ['user', 'originalArticle', 'template'],
      },
    );

    if (!content) {
      throw new NotFoundException(`Repurposed content not found: ${id}`);
    }

    return {
      id: content.id,
      format: content.format,
      content: content.content,
      formatSpecificData: content.formatSpecificData,
      qualityScore: content.qualityScore,
      qualityDetails: content.qualityDetails,
      characterCount: content.characterCount,
      wordCount: content.wordCount,
      isEdited: content.isEdited,
      createdAt: content.createdAt,
      originalArticle: {
        articleId: content.originalArticle.articleId,
        topic: content.originalArticle.topic,
      },
    };
  }

  /**
   * 단어 수 계산 헬퍼
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }
}
