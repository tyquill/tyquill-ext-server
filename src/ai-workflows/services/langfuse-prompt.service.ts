import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PromptTemplate } from '@langchain/core/prompts';
import type { ChatPromptClient, LangfuseClient, TextPromptClient } from '@langfuse/client' with { "resolution-mode": "import" };

type ChatPromptTemplate = ReturnType<ChatPromptClient['getLangchainPrompt']>;
type ChatPromptContent = ChatPromptClient['prompt'];

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
  private langfuseClient: LangfuseClient | null = null;

  constructor(private readonly configService: ConfigService) {}

  private async initLangfuseClient(): Promise<LangfuseClient | null> {
    if (this.langfuseClient) {
      return this.langfuseClient;
    }

    const secretKey = this.configService.get<string>('LANGFUSE_SECRET_KEY');
    const publicKey = this.configService.get<string>('LANGFUSE_PUBLIC_KEY');
    const baseUrl = this.configService.get<string>('LANGFUSE_BASE_URL');

    if (!secretKey || !publicKey || !baseUrl) {
      this.logger.warn('Langfuse credentials not found. Prompt management features will be disabled.');
      return null;
    }

    const { LangfuseClient } = await import('@langfuse/client');

    this.langfuseClient = new LangfuseClient({
      secretKey,
      publicKey,
      baseUrl,
    });
    this.logger.log('Langfuse Prompt Management initialized');

    return this.langfuseClient;
  }

  private async getClientOrThrow(): Promise<LangfuseClient> {
    const client = await this.initLangfuseClient();
    if (!client) {
      throw new Error('Langfuse client is not initialized. Please check your configuration.');
    }
    return client;
  }

  async onModuleInit() {
    const client = await this.initLangfuseClient();
    if (!client) {
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
      type?: 'text';
    },
  ): Promise<PromptTemplate>;
  async getPrompt(
    name: string,
    options: {
      version?: number;
      label?: string;
      type: 'chat';
    },
  ): Promise<ChatPromptTemplate>;
  async getPrompt(
    name: string,
    options?: {
      version?: number;
      label?: string;
      type?: 'text' | 'chat';
    },
  ): Promise<PromptTemplate | ChatPromptTemplate> {
    const client = await this.getClientOrThrow();

    try {
      const label = options?.label || 'production';

      if (options?.type === 'chat') {
        const prompt = await client.prompt.get(name, {
          version: options?.version,
          label,
          type: 'chat',
        });

        const langchainPrompt = prompt.getLangchainPrompt();

        this.logger.debug(`Loaded prompt '${name}' from Langfuse (version: ${prompt.version}, label: ${label}, type: chat)`);

        return langchainPrompt;
      }

      const prompt = await client.prompt.get(name, {
        version: options?.version,
        label,
        type: 'text',
      });

      // Convert Langfuse prompt to Langchain PromptTemplate
      const langchainPromptString = prompt.getLangchainPrompt();

      this.logger.debug(`Loaded prompt '${name}' from Langfuse (version: ${prompt.version}, label: ${label}, type: text)`);

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
      type?: 'text';
    },
  ): Promise<TextPromptClient['prompt']>;
  async getRawPrompt(
    name: string,
    options: {
      version?: number;
      label?: string;
      type: 'chat';
    },
  ): Promise<ChatPromptContent>;
  async getRawPrompt(
    name: string,
    options?: {
      version?: number;
      label?: string;
      type?: 'text' | 'chat';
    },
  ): Promise<TextPromptClient['prompt'] | ChatPromptContent> {
    const client = await this.getClientOrThrow();

    try {
      const label = options?.label || 'production';

      if (options?.type === 'chat') {
        const prompt = await client.prompt.get(name, {
          version: options?.version,
          label,
          type: 'chat',
        });

        this.logger.debug(`Loaded raw prompt '${name}' from Langfuse (version: ${prompt.version}, type: chat)`);

        return prompt.prompt;
      }

      const prompt = await client.prompt.get(name, {
        version: options?.version,
        label,
        type: 'text',
      });

      this.logger.debug(`Loaded raw prompt '${name}' from Langfuse (version: ${prompt.version}, type: text)`);

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
      type?: 'text';
    },
  ): Promise<{
    template: PromptTemplate;
    config: any;
    version: number;
  }>;
  async getPromptWithConfig(
    name: string,
    options: {
      version?: number;
      label?: string;
      type: 'chat';
    },
  ): Promise<{
    template: ChatPromptTemplate;
    config: any;
    version: number;
  }>;
  async getPromptWithConfig(
    name: string,
    options?: {
      version?: number;
      label?: string;
      type?: 'text' | 'chat';
    },
  ): Promise<{
    template: PromptTemplate | ChatPromptTemplate;
    config: any;
    version: number;
  }> {
    const client = await this.getClientOrThrow();

    try {
      const label = options?.label || 'production';

      if (options?.type === 'chat') {
        const prompt = await client.prompt.get(name, {
          version: options?.version,
          label,
          type: 'chat',
        });

        const template = prompt.getLangchainPrompt();

        this.logger.debug(`Loaded prompt with config '${name}' from Langfuse (version: ${prompt.version}, type: chat)`);

        return {
          template,
          config: prompt.config,
          version: prompt.version,
        };
      }

      const prompt = await client.prompt.get(name, {
        version: options?.version,
        label,
        type: 'text',
      });

      const langchainPromptString = prompt.getLangchainPrompt();
      const template = PromptTemplate.fromTemplate(langchainPromptString);

      this.logger.debug(`Loaded prompt with config '${name}' from Langfuse (version: ${prompt.version}, type: text)`);

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
    prompt: TextPromptClient['prompt'],
    options?: {
      type?: 'text';
      labels?: string[];
      config?: any;
      tags?: string[];
      commitMessage?: string;
    },
  ): Promise<void>;
  async createOrUpdatePrompt(
    name: string,
    prompt: ChatPromptContent,
    options: {
      type: 'chat';
      labels?: string[];
      config?: any;
      tags?: string[];
      commitMessage?: string;
    },
  ): Promise<void>;
  async createOrUpdatePrompt(
    name: string,
    prompt: TextPromptClient['prompt'] | ChatPromptContent,
    options?: {
      type?: 'text' | 'chat';
      labels?: string[];
      config?: any;
      tags?: string[];
      commitMessage?: string;
    },
  ): Promise<void> {
    const client = await this.getClientOrThrow();

    try {
      const labels = options?.labels || ['production'];

      if (options?.type === 'chat') {
        await client.prompt.create({
          name,
          prompt: prompt as ChatPromptContent,
          type: 'chat',
          labels,
          config: options?.config,
          tags: options?.tags,
        });

        this.logger.log(`Successfully created/updated chat prompt '${name}' in Langfuse`);
        return;
      }

      await client.prompt.create({
        name,
        prompt: prompt as TextPromptClient['prompt'],
        type: 'text',
        labels,
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
  async getClient(): Promise<LangfuseClient> {
    return this.getClientOrThrow();
  }
}
