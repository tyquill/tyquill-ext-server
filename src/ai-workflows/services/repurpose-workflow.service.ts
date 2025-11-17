import { Injectable, Logger } from '@nestjs/common';
import { ChatVertexAI } from '@langchain/google-vertexai';
import { RepurposePromptTemplatesService } from '../prompts/repurpose-prompt-templates.service';
import { VertexAiFactory } from './vertex-ai.factory';
import { ContentFormat } from '../../repurpose/entities';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

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

      // 2. 프롬프트 변수 준비
      const promptVariables = this.preparePromptVariables(input);
      const formattedPrompt = await template.format(promptVariables);

      // 3. 포맷에 따라 적절한 모델로 생성
      let parsedResponse: { content: string; formatSpecificData?: Record<string, any> };

      if (this.isJsonFormat(input.format)) {
        // Structured output을 사용하는 JSON 포맷
        const { model, schema } = this.createStructuredModel(input.format);
        const structuredResponse = await model.invoke(formattedPrompt);
        parsedResponse = this.parseJsonResponse(input.format, structuredResponse);
      } else {
        // 일반 텍스트 포맷
        const model = this.createTextModel();
        const response = await model.invoke(formattedPrompt);
        parsedResponse = {
          content: response.content as string,
        };
      }

      // 4. 품질 평가
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
   * Structured output을 사용하는 모델 생성
   */
  private createStructuredModel(format: ContentFormat): {
    model: any;
    schema: z.ZodType<any>
  } {
    const schema = this.getSchemaForFormat(format);
    const baseModel = this.vertexAiFactory.buildChat({
      model: VERTEX_MODEL_REPURPOSE,
      temperature: 0.7,
      thinkingBudget: -1,
      maxOutputTokens: 4096,
    });

    // withStructuredOutput을 사용하여 스키마 강제
    const structuredModel = baseModel.withStructuredOutput(schema, {
      method: 'functionCalling',
    });

    return { model: structuredModel, schema };
  }

  /**
   * 일반 텍스트 모델 생성
   */
  private createTextModel(): ChatVertexAI {
    return this.vertexAiFactory.buildChat({
      model: VERTEX_MODEL_REPURPOSE,
      temperature: 0.7,
      thinkingBudget: -1,
      maxOutputTokens: 8192,
    });
  }

  /**
   * 포맷별 Zod 스키마 가져오기
   */
  private getSchemaForFormat(format: ContentFormat): z.ZodType<any> {
    switch (format) {
      case ContentFormat.TWITTER:
        return TwitterResponseSchema;
      case ContentFormat.INSTAGRAM:
        return InstagramResponseSchema;
      case ContentFormat.YOUTUBE:
        return YoutubeResponseSchema;
      case ContentFormat.TIKTOK:
        return TikTokResponseSchema;
      case ContentFormat.EMAIL:
        return EmailResponseSchema;
      case ContentFormat.PODCAST:
        return PodcastResponseSchema;
      default:
        throw new Error(`No schema defined for format: ${format}`);
    }
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
   * 응답 파싱 (레거시 메서드, 새로운 워크플로우에서는 사용하지 않음)
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
   * JSON 응답 파싱 (structured output에서 이미 검증된 데이터)
   */
  private parseJsonResponse(
    format: ContentFormat,
    validatedData: any,
  ): { content: string; formatSpecificData: Record<string, any> } {
    switch (format) {
      case ContentFormat.TWITTER: {
        return {
          content: validatedData.tweets.join('\n\n'),
          formatSpecificData: {
            tweets: validatedData.tweets,
            hashtags: validatedData.hashtags,
          },
        };
      }

      case ContentFormat.INSTAGRAM: {
        return {
          content: validatedData.caption,
          formatSpecificData: {
            hashtags: validatedData.hashtags,
            suggestedVisuals: validatedData.suggestedVisuals,
          },
        };
      }

      case ContentFormat.YOUTUBE: {
        return {
          content: validatedData.script,
          formatSpecificData: {
            timestamps: validatedData.timestamps,
            visualCues: validatedData.visualCues,
          },
        };
      }

      case ContentFormat.TIKTOK: {
        return {
          content: validatedData.script,
          formatSpecificData: {
            textOverlays: validatedData.textOverlays,
            hashtags: validatedData.hashtags,
            soundSuggestion: validatedData.soundSuggestion,
          },
        };
      }

      case ContentFormat.EMAIL: {
        return {
          content: validatedData.body,
          formatSpecificData: {
            subjectLine: validatedData.subjectLine,
            preheader: validatedData.preheader,
            cta: validatedData.cta,
          },
        };
      }

      case ContentFormat.PODCAST: {
        return {
          content: validatedData.script,
          formatSpecificData: {
            segments: validatedData.segments,
            episodeTitle: validatedData.episodeTitle,
            episodeDescription: validatedData.episodeDescription,
          },
        };
      }

      default:
        return {
          content: JSON.stringify(validatedData, null, 2),
          formatSpecificData: validatedData,
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
