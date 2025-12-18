import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import { LangfusePromptService } from '../services/langfuse-prompt.service';

/**
 * Newsletter Prompt Templates Service using Langfuse
 *
 * This service fetches prompts from Langfuse instead of storing them locally.
 * Benefits:
 * - Centralized prompt management
 * - Version control and rollback
 * - A/B testing capabilities
 * - Analytics and monitoring
 * - No need to redeploy for prompt changes
 */
@Injectable()
export class NewsletterPromptTemplatesService implements OnModuleInit {
  private readonly logger = new Logger(NewsletterPromptTemplatesService.name);

  // Prompt names in Langfuse
  private readonly PROMPT_NAMES = {
    SIMPLE_NEWSLETTER: 'newsletter-simple',
    SIMPLE_NEWSLETTER_TITLE: 'newsletter-simple-title',
    ARTICLE_REFLECTOR: 'newsletter-article-reflector',
    WRITING_STYLE_REWRITE: 'newsletter-writing-style-rewrite',
    STRUCTURE_ANALYSIS: 'newsletter-structure-analysis',
    KOREAN_NEWSLETTER: 'newsletter-korean',
    KOREAN_NEWSLETTER_TITLE: 'newsletter-korean-title',
    KOREAN_ARTICLE_REFLECTOR: 'newsletter-korean-article-reflector',
    KOREAN_WRITING_STYLE_REWRITE: 'newsletter-korean-writing-style-rewrite',
  };

  // Cache prompts in memory for performance
  private promptCache: Map<string, { template: PromptTemplate; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 60 * 1000; // 60 seconds

  constructor(private readonly langfusePromptService: LangfusePromptService) {}

  async onModuleInit() {
    this.logger.log('Newsletter Prompt Templates Service initialized with Langfuse');
    // Optionally pre-fetch prompts on startup for zero-latency first use
    await this.prefetchPrompts();
  }

  /**
   * Pre-fetch all prompts to cache them on startup
   * This ensures zero-latency from the first use
   */
  private async prefetchPrompts() {
    try {
      this.logger.log('Pre-fetching prompts from Langfuse...');
      const promptNames = Object.values(this.PROMPT_NAMES);

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

      this.logger.log(`Pre-fetched ${this.promptCache.size}/${promptNames.length} prompts`);
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

  async getSimpleNewsletterTemplate(): Promise<PromptTemplate> {
    return this.getPromptTemplate(this.PROMPT_NAMES.SIMPLE_NEWSLETTER);
  }

  async getSimpleNewsletterTitleTemplate(): Promise<PromptTemplate> {
    return this.getPromptTemplate(this.PROMPT_NAMES.SIMPLE_NEWSLETTER_TITLE);
  }

  async getArticleReflectorTemplate(): Promise<PromptTemplate> {
    return this.getPromptTemplate(this.PROMPT_NAMES.ARTICLE_REFLECTOR);
  }

  async getWritingStyleRewriteTemplate(): Promise<PromptTemplate> {
    return this.getPromptTemplate(this.PROMPT_NAMES.WRITING_STYLE_REWRITE);
  }

  async getStructureAnalysisTemplate(): Promise<PromptTemplate> {
    return this.getPromptTemplate(this.PROMPT_NAMES.STRUCTURE_ANALYSIS);
  }

  // Korean-specific template getters
  async getKoreanNewsletterTemplate(): Promise<PromptTemplate> {
    return this.getPromptTemplate(this.PROMPT_NAMES.KOREAN_NEWSLETTER);
  }

  async getKoreanNewsletterTitleTemplate(): Promise<PromptTemplate> {
    return this.getPromptTemplate(this.PROMPT_NAMES.KOREAN_NEWSLETTER_TITLE);
  }

  async getKoreanArticleReflectorTemplate(): Promise<PromptTemplate> {
    return this.getPromptTemplate(this.PROMPT_NAMES.KOREAN_ARTICLE_REFLECTOR);
  }

  async getKoreanWritingStyleRewriteTemplate(): Promise<PromptTemplate> {
    return this.getPromptTemplate(this.PROMPT_NAMES.KOREAN_WRITING_STYLE_REWRITE);
  }

  /**
   * Clear the prompt cache
   * Useful for forcing a refresh of all prompts
   */
  clearCache() {
    this.promptCache.clear();
    this.logger.log('Prompt cache cleared');
  }

  /**
   * Get all prompt names used by this service
   */
  getPromptNames(): string[] {
    return Object.values(this.PROMPT_NAMES);
  }
}
