import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import { ContentFormat } from '../../repurpose/entities';
import { LangfusePromptService } from '../services/langfuse-prompt.service';

/**
 * Repurpose Prompt Templates Service using Langfuse
 *
 * This service fetches platform-specific repurposing prompts from Langfuse.
 * Benefits:
 * - Centralized prompt management
 * - Version control and rollback
 * - A/B testing capabilities
 * - Analytics and monitoring
 * - Easy platform-specific prompt updates without redeployment
 */
@Injectable()
export class RepurposePromptTemplatesService implements OnModuleInit {
  private readonly logger = new Logger(RepurposePromptTemplatesService.name);

  // Prompt names in Langfuse (mapped to ContentFormat)
  private readonly PROMPT_NAME_MAP: Record<ContentFormat, string> = {
    [ContentFormat.BLOG]: 'repurpose-blog',
    [ContentFormat.TWITTER]: 'repurpose-twitter',
    [ContentFormat.LINKEDIN]: 'repurpose-linkedin',
    [ContentFormat.INSTAGRAM]: 'repurpose-instagram',
    [ContentFormat.YOUTUBE]: 'repurpose-youtube',
    [ContentFormat.TIKTOK]: 'repurpose-tiktok',
    [ContentFormat.EMAIL]: 'repurpose-email',
    [ContentFormat.PODCAST]: 'repurpose-podcast',
    [ContentFormat.CUSTOM]: 'repurpose-custom',
  };

  // Cache prompts in memory for performance
  private promptCache: Map<string, { template: PromptTemplate; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 60 * 1000; // 60 seconds

  constructor(private readonly langfusePromptService: LangfusePromptService) {}

  async onModuleInit() {
    this.logger.log('Repurpose Prompt Templates Service initialized with Langfuse');
    // Optionally pre-fetch prompts on startup for zero-latency first use
    await this.prefetchPrompts();
  }

  /**
   * Pre-fetch all prompts to cache them on startup
   * This ensures zero-latency from the first use
   */
  private async prefetchPrompts() {
    try {
      this.logger.log('Pre-fetching repurpose prompts from Langfuse...');
      const promptNames = Object.values(this.PROMPT_NAME_MAP);

      await Promise.allSettled(
        promptNames.map(async (name) => {
          try {
            const template = await this.langfusePromptService.getPrompt(name);
            this.promptCache.set(name, {
              template,
              timestamp: Date.now(),
            });
          } catch (error) {
            this.logger.warn(`Failed to pre-fetch prompt '${name}': ${(error as Error).message}`);
          }
        })
      );

      this.logger.log(`Pre-fetched ${this.promptCache.size}/${promptNames.length} repurpose prompts`);
    } catch (error) {
      this.logger.error('Error during prompt pre-fetching:', error);
    }
  }

  /**
   * Get a prompt template from Langfuse with caching
   */
  private async getPromptTemplate(name: string): Promise<PromptTemplate> {
    // Check cache first
    const cached = this.promptCache.get(name);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL_MS) {
      return cached.template;
    }

    // Fetch from Langfuse
    try {
      const template = await this.langfusePromptService.getPrompt(name);

      // Update cache
      this.promptCache.set(name, {
        template,
        timestamp: Date.now(),
      });

      return template;
    } catch (error) {
      // If fetch fails and we have a cached version (even if stale), use it as fallback
      if (cached) {
        this.logger.warn(`Using stale cached prompt for '${name}' due to fetch error`);
        return cached.template;
      }
      throw error;
    }
  }

  /**
   * 포맷에 맞는 프롬프트 템플릿 반환
   */
  async getTemplateByFormat(format: ContentFormat): Promise<PromptTemplate> {
    const promptName = this.PROMPT_NAME_MAP[format];
    if (!promptName) {
      throw new Error(`Unsupported content format: ${format}`);
    }
    return this.getPromptTemplate(promptName);
  }

  /**
   * 여러 포맷의 템플릿을 한번에 가져오기
   */
  async getTemplatesByFormats(formats: ContentFormat[]): Promise<Map<ContentFormat, PromptTemplate>> {
    const templates = new Map<ContentFormat, PromptTemplate>();

    await Promise.all(
      formats.map(async (format) => {
        try {
          const template = await this.getTemplateByFormat(format);
          templates.set(format, template);
        } catch (error) {
          this.logger.error(`Failed to fetch template for format ${format}:`, error);
        }
      })
    );

    return templates;
  }

  /**
   * 모든 포맷의 템플릿 가져오기
   */
  async getAllTemplates(): Promise<Map<ContentFormat, PromptTemplate>> {
    const allFormats = Object.values(ContentFormat);
    return this.getTemplatesByFormats(allFormats);
  }

  /**
   * Clear the prompt cache
   * Useful for forcing a refresh of all prompts
   */
  clearCache() {
    this.promptCache.clear();
    this.logger.log('Repurpose prompt cache cleared');
  }

  /**
   * Get all prompt names used by this service
   */
  getPromptNames(): string[] {
    return Object.values(this.PROMPT_NAME_MAP);
  }

  /**
   * Get prompt name for a specific format
   */
  getPromptNameForFormat(format: ContentFormat): string {
    const name = this.PROMPT_NAME_MAP[format];
    if (!name) {
      throw new Error(`Unsupported content format: ${format}`);
    }
    return name;
  }
}
