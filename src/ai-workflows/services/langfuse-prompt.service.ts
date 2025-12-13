import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LangfuseClient } from '@langfuse/client';
import { PromptTemplate } from '@langchain/core/prompts';

/**
 * Langfuse Prompt Management Service
 *
 * This service provides centralized prompt management using Langfuse.
 * All prompts are stored and versioned in Langfuse, enabling:
 * - Centralized prompt management
 * - Version control
 * - A/B testing
 * - Prompt analytics
 * - Easy rollback and deployment
 */
@Injectable()
export class LangfusePromptService implements OnModuleInit {
  private readonly logger = new Logger(LangfusePromptService.name);
  private langfuseClient: LangfuseClient;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('LANGFUSE_SECRET_KEY');
    const publicKey = this.configService.get<string>('LANGFUSE_PUBLIC_KEY');
    const baseUrl = this.configService.get<string>('LANGFUSE_BASE_URL');

    if (!secretKey || !publicKey || !baseUrl) {
      this.logger.warn('Langfuse credentials not found. Prompt management features will be disabled.');
      this.langfuseClient = null as any;
    } else {
      this.langfuseClient = new LangfuseClient({
        secretKey,
        publicKey,
        baseUrl,
      });
      this.logger.log('Langfuse Prompt Management initialized');
    }
  }

  async onModuleInit() {
    if (!this.langfuseClient) {
      this.logger.warn('Langfuse client is not initialized. Skipping module initialization.');
      return;
    }
    this.logger.log('Langfuse Prompt Management service is ready');
  }

  /**
   * Get a prompt from Langfuse by name
   * @param name - The prompt name
   * @param options - Optional parameters (version, label, type)
   * @returns PromptTemplate compatible with Langchain
   */
  async getPrompt(
    name: string,
    options?: {
      version?: number;
      label?: string;
      type?: 'text' | 'chat';
    },
  ): Promise<PromptTemplate> {
    if (!this.langfuseClient) {
      throw new Error('Langfuse client is not initialized. Please check your configuration.');
    }

    try {
      const prompt = await this.langfuseClient.prompt.get(name, {
        version: options?.version,
        label: options?.label || 'production',
        type: options?.type || 'text',
      });

      // Convert Langfuse prompt to Langchain PromptTemplate
      const langchainPromptString = prompt.getLangchainPrompt();

      this.logger.debug(`Loaded prompt '${name}' from Langfuse (version: ${prompt.version}, label: ${options?.label || 'production'})`);

      return PromptTemplate.fromTemplate(langchainPromptString);
    } catch (error) {
      this.logger.error(`Failed to load prompt '${name}' from Langfuse`, error as Error);
      throw new Error(`Failed to load prompt '${name}' from Langfuse: ${(error as Error).message}`);
    }
  }

  /**
   * Get raw prompt content from Langfuse
   * @param name - The prompt name
   * @param options - Optional parameters (version, label, type)
   * @returns Raw prompt content
   */
  async getRawPrompt(
    name: string,
    options?: {
      version?: number;
      label?: string;
      type?: 'text' | 'chat';
    },
  ): Promise<string> {
    if (!this.langfuseClient) {
      throw new Error('Langfuse client is not initialized. Please check your configuration.');
    }

    try {
      const prompt = await this.langfuseClient.prompt.get(name, {
        version: options?.version,
        label: options?.label || 'production',
        type: options?.type || 'text',
      });

      this.logger.debug(`Loaded raw prompt '${name}' from Langfuse (version: ${prompt.version})`);

      return prompt.prompt;
    } catch (error) {
      this.logger.error(`Failed to load raw prompt '${name}' from Langfuse`, error as Error);
      throw new Error(`Failed to load raw prompt '${name}' from Langfuse: ${(error as Error).message}`);
    }
  }

  /**
   * Get prompt with config from Langfuse
   * @param name - The prompt name
   * @param options - Optional parameters (version, label, type)
   * @returns Prompt content and config
   */
  async getPromptWithConfig(
    name: string,
    options?: {
      version?: number;
      label?: string;
      type?: 'text' | 'chat';
    },
  ): Promise<{
    template: PromptTemplate;
    config: any;
    version: number;
  }> {
    if (!this.langfuseClient) {
      throw new Error('Langfuse client is not initialized. Please check your configuration.');
    }

    try {
      const prompt = await this.langfuseClient.prompt.get(name, {
        version: options?.version,
        label: options?.label || 'production',
        type: options?.type || 'text',
      });

      const langchainPromptString = prompt.getLangchainPrompt();
      const template = PromptTemplate.fromTemplate(langchainPromptString);

      this.logger.debug(`Loaded prompt with config '${name}' from Langfuse (version: ${prompt.version})`);

      return {
        template,
        config: prompt.config,
        version: prompt.version,
      };
    } catch (error) {
      this.logger.error(`Failed to load prompt with config '${name}' from Langfuse`, error as Error);
      throw new Error(`Failed to load prompt with config '${name}' from Langfuse: ${(error as Error).message}`);
    }
  }

  /**
   * Create or update a prompt in Langfuse
   * @param name - The prompt name
   * @param prompt - The prompt content
   * @param options - Additional options
   */
  async createOrUpdatePrompt(
    name: string,
    prompt: string,
    options?: {
      type?: 'text' | 'chat';
      labels?: string[];
      config?: any;
      tags?: string[];
      commitMessage?: string;
    },
  ): Promise<void> {
    if (!this.langfuseClient) {
      throw new Error('Langfuse client is not initialized. Please check your configuration.');
    }

    try {
      await this.langfuseClient.prompt.create({
        name,
        prompt,
        type: options?.type || 'text',
        labels: options?.labels || ['production'],
        config: options?.config,
        tags: options?.tags,
      });

      this.logger.log(`Successfully created/updated prompt '${name}' in Langfuse`);
    } catch (error) {
      this.logger.error(`Failed to create/update prompt '${name}' in Langfuse`, error as Error);
      throw new Error(`Failed to create/update prompt '${name}' in Langfuse: ${(error as Error).message}`);
    }
  }

  /**
   * Get the Langfuse client instance
   * @returns LangfuseClient instance
   */
  getClient(): LangfuseClient {
    if (!this.langfuseClient) {
      throw new Error('Langfuse client is not initialized. Please check your configuration.');
    }
    return this.langfuseClient;
  }
}
