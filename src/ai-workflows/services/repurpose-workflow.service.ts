import { Injectable, Logger } from '@nestjs/common';
import { ChatVertexAI } from './vertex-chat.model';
import { RepurposePromptTemplatesService } from '../prompts/repurpose-prompt-templates.service';
import { VertexAiFactory } from './vertex-ai.factory';
import { ContentFormat } from '../../repurpose/entities';
import { z } from 'zod';

const VERTEX_MODEL_REPURPOSE = 'gemini-2.5-flash';

/**
 * 리퍼포징 워크플로우 입력
 */
export interface RepurposeWorkflowInput {
  articleTitle: string;
  articleContent: string;
  format: ContentFormat;
  targetAudience?: string;
  keyMessage?: string;
  professionalContext?: string;
  visualContext?: string;
  channelStyle?: string;
  podcastStyle?: string;
  hostPersonality?: string;
  audienceSegment?: string;
  tone?: string;
}

/**
 * 리퍼포징 워크플로우 출력
 */
export interface RepurposeWorkflowOutput {
  content: string;
  formatSpecificData?: Record<string, any>;
  qualityScore: number;
  qualityDetails: Record<string, any>;
}

/**
 * Twitter 응답 스키마
 */
const TwitterResponseSchema = z.object({
  tweets: z.array(z.string()),
  hashtags: z.array(z.string()),
});

/**
 * Instagram 응답 스키마
 */
const InstagramResponseSchema = z.object({
  caption: z.string(),
  hashtags: z.array(z.string()),
  suggestedVisuals: z.string(),
});

/**
 * YouTube 응답 스키마
 */
const YoutubeResponseSchema = z.object({
  script: z.string(),
  timestamps: z.array(z.object({
    time: z.string(),
    title: z.string(),
  })),
  visualCues: z.array(z.string()),
});

/**
 * TikTok 응답 스키마
 */
const TikTokResponseSchema = z.object({
  script: z.string(),
  textOverlays: z.array(z.string()),
  hashtags: z.array(z.string()),
  soundSuggestion: z.string(),
});

/**
 * Email 응답 스키마
 */
const EmailResponseSchema = z.object({
  subjectLine: z.string(),
  preheader: z.string(),
  body: z.string(),
  cta: z.array(z.object({
    text: z.string(),
    type: z.enum(['primary', 'secondary']),
  })),
});

/**
 * Podcast 응답 스키마
 */
const PodcastResponseSchema = z.object({
  script: z.string(),
  segments: z.array(z.object({
    timestamp: z.string(),
    title: z.string(),
  })),
  episodeTitle: z.string(),
  episodeDescription: z.string(),
});

@Injectable()
export class RepurposeWorkflowService {
  private readonly logger = new Logger(RepurposeWorkflowService.name);
  private readonly promptTemplates: RepurposePromptTemplatesService;

  constructor(private readonly vertexAiFactory: VertexAiFactory) {
    this.promptTemplates = new RepurposePromptTemplatesService();
  }

  /**
   * 리퍼포징 워크플로우 실행
   */
  async repurpose(input: RepurposeWorkflowInput): Promise<RepurposeWorkflowOutput> {
    this.logger.log(`Starting repurpose workflow for format: ${input.format}`);

    try {
      // 1. 포맷별 프롬프트 템플릿 가져오기
      const template = this.promptTemplates.getTemplateByFormat(input.format);

      // 2. LLM 모델 생성
      const model = this.createModel(input.format);

      // 3. 프롬프트 변수 준비
      const promptVariables = this.preparePromptVariables(input);

      // 4. 프롬프트 생성 및 LLM 호출
      const formattedPrompt = await template.format(promptVariables);
      const response = await model.invoke(formattedPrompt);

      // 5. 응답 파싱
      const parsedResponse = this.parseResponse(input.format, response.content as string);

      // 6. 품질 평가
      const qualityAssessment = await this.assessQuality(
        input,
        parsedResponse.content,
      );

      return {
        content: parsedResponse.content,
        formatSpecificData: parsedResponse.formatSpecificData,
        qualityScore: qualityAssessment.score,
        qualityDetails: qualityAssessment.details,
      };
    } catch (error) {
      this.logger.error(`Repurpose workflow failed for format ${input.format}`, error);
      throw error;
    }
  }

  /**
   * 포맷별 모델 생성
   */
  private createModel(format: ContentFormat): ChatVertexAI {
    // JSON 출력이 필요한 포맷
    const jsonFormats = [
      ContentFormat.TWITTER,
      ContentFormat.INSTAGRAM,
      ContentFormat.YOUTUBE,
      ContentFormat.TIKTOK,
      ContentFormat.EMAIL,
      ContentFormat.PODCAST,
    ];

    // JSON 포맷용 모델
    if (jsonFormats.includes(format)) {
      return this.vertexAiFactory.buildChat({
        model: VERTEX_MODEL_REPURPOSE,
        temperature: 0.7,
        thinkingBudget: -1,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      });
    }

    // 일반 텍스트 포맷용 모델
    return this.vertexAiFactory.buildChat({
      model: VERTEX_MODEL_REPURPOSE,
      temperature: 0.7,
      thinkingBudget: -1,
      maxOutputTokens: 8192,
    });
  }

  /**
   * 프롬프트 변수 준비
   */
  private preparePromptVariables(input: RepurposeWorkflowInput): Record<string, string> {
    return {
      title: input.articleTitle || 'Untitled',
      content: input.articleContent,
      targetAudience: input.targetAudience || 'general audience',
      keyMessage: input.keyMessage || 'extracted from article',
      professionalContext: input.professionalContext || '',
      visualContext: input.visualContext || '',
      channelStyle: input.channelStyle || '',
      podcastStyle: input.podcastStyle || 'conversational',
      hostPersonality: input.hostPersonality || 'friendly',
      audienceSegment: input.audienceSegment || 'subscribers',
    };
  }

  /**
   * 응답 파싱
   */
  private parseResponse(
    format: ContentFormat,
    responseContent: string,
  ): { content: string; formatSpecificData?: Record<string, any> } {
    try {
      // JSON 응답이 필요한 포맷
      if (this.isJsonFormat(format)) {
        const jsonData = JSON.parse(responseContent);
        return this.parseJsonResponse(format, jsonData);
      }

      // 일반 텍스트 응답 (Blog, LinkedIn)
      return {
        content: responseContent,
      };
    } catch (error) {
      this.logger.warn(`Failed to parse JSON response for ${format}, using raw text`);
      return {
        content: responseContent,
      };
    }
  }

  /**
   * JSON 포맷 여부 확인
   */
  private isJsonFormat(format: ContentFormat): boolean {
    return [
      ContentFormat.TWITTER,
      ContentFormat.INSTAGRAM,
      ContentFormat.YOUTUBE,
      ContentFormat.TIKTOK,
      ContentFormat.EMAIL,
      ContentFormat.PODCAST,
    ].includes(format);
  }

  /**
   * JSON 응답 파싱
   */
  private parseJsonResponse(
    format: ContentFormat,
    jsonData: any,
  ): { content: string; formatSpecificData: Record<string, any> } {
    switch (format) {
      case ContentFormat.TWITTER: {
        const validated = TwitterResponseSchema.parse(jsonData);
        return {
          content: validated.tweets.join('\n\n'),
          formatSpecificData: {
            tweets: validated.tweets,
            hashtags: validated.hashtags,
          },
        };
      }

      case ContentFormat.INSTAGRAM: {
        const validated = InstagramResponseSchema.parse(jsonData);
        return {
          content: validated.caption,
          formatSpecificData: {
            hashtags: validated.hashtags,
            suggestedVisuals: validated.suggestedVisuals,
          },
        };
      }

      case ContentFormat.YOUTUBE: {
        const validated = YoutubeResponseSchema.parse(jsonData);
        return {
          content: validated.script,
          formatSpecificData: {
            timestamps: validated.timestamps,
            visualCues: validated.visualCues,
          },
        };
      }

      case ContentFormat.TIKTOK: {
        const validated = TikTokResponseSchema.parse(jsonData);
        return {
          content: validated.script,
          formatSpecificData: {
            textOverlays: validated.textOverlays,
            hashtags: validated.hashtags,
            soundSuggestion: validated.soundSuggestion,
          },
        };
      }

      case ContentFormat.EMAIL: {
        const validated = EmailResponseSchema.parse(jsonData);
        return {
          content: validated.body,
          formatSpecificData: {
            subjectLine: validated.subjectLine,
            preheader: validated.preheader,
            cta: validated.cta,
          },
        };
      }

      case ContentFormat.PODCAST: {
        const validated = PodcastResponseSchema.parse(jsonData);
        return {
          content: validated.script,
          formatSpecificData: {
            segments: validated.segments,
            episodeTitle: validated.episodeTitle,
            episodeDescription: validated.episodeDescription,
          },
        };
      }

      default:
        return {
          content: JSON.stringify(jsonData, null, 2),
          formatSpecificData: jsonData,
        };
    }
  }

  /**
   * 품질 평가
   */
  private async assessQuality(
    input: RepurposeWorkflowInput,
    generatedContent: string,
  ): Promise<{ score: number; details: Record<string, any> }> {
    // TODO: 실제 품질 평가 로직 구현
    // 현재는 간단한 휴리스틱 기반 평가

    const contentLength = generatedContent.length;
    const wordCount = generatedContent.split(/\s+/).length;

    // 포맷별 권장 길이
    const recommendedLengths: Record<ContentFormat, { min: number; max: number }> = {
      [ContentFormat.BLOG]: { min: 1500, max: 3000 },
      [ContentFormat.TWITTER]: { min: 200, max: 500 },
      [ContentFormat.LINKEDIN]: { min: 500, max: 2000 },
      [ContentFormat.INSTAGRAM]: { min: 300, max: 1500 },
      [ContentFormat.YOUTUBE]: { min: 1000, max: 3000 },
      [ContentFormat.TIKTOK]: { min: 100, max: 300 },
      [ContentFormat.EMAIL]: { min: 500, max: 1500 },
      [ContentFormat.PODCAST]: { min: 1500, max: 3500 },
      [ContentFormat.CUSTOM]: { min: 100, max: 5000 },
    };

    const { min, max } = recommendedLengths[input.format];
    const lengthScore = this.calculateLengthScore(wordCount, min, max);

    // 간단한 품질 지표
    const relevance = 80; // TODO: 실제 relevance 평가
    const clarity = 75; // TODO: 실제 clarity 평가
    const engagement = 70; // TODO: 실제 engagement 평가

    const overallScore = Math.round((lengthScore + relevance + clarity + engagement) / 4);

    return {
      score: overallScore,
      details: {
        lengthScore,
        relevance,
        clarity,
        engagement,
        wordCount,
        recommendedRange: `${min}-${max} words`,
      },
    };
  }

  /**
   * 길이 점수 계산
   */
  private calculateLengthScore(wordCount: number, min: number, max: number): number {
    if (wordCount < min) {
      return Math.max(0, 50 + (wordCount / min) * 50);
    }
    if (wordCount > max) {
      return Math.max(0, 100 - ((wordCount - max) / max) * 50);
    }
    return 100;
  }
}
