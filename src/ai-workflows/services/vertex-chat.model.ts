import type {
  Content,
  Part,
  SafetySetting,
} from '@google/genai' with { 'resolution-mode': 'import' };
import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { isBaseMessage } from '@langchain/core/messages';
import type { ZodTypeAny } from 'zod';
import type { GoogleAuthOptions } from 'google-auth-library';
import type { BasePromptValue } from '@langchain/core/prompt_values';

type MessageInput = string | BaseMessage | BaseMessage[] | BasePromptValue;

interface GenerationOverrides {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  responseMimeType?: string;
  responseSchema?: Record<string, unknown>;
}

export interface ChatVertexAIInput extends GenerationOverrides {
  model: string;
  location?: string;
  project?: string;
  apiVersion?: string;
  vertexai?: boolean;
  safetySettings?: SafetySetting[];
  authOptions?: GoogleAuthOptions;
  thinkingBudget?: number;
}

export class ChatVertexAI {
  private readonly clientPromise: Promise<any>;

  constructor(private readonly options: ChatVertexAIInput) {
    this.clientPromise = this.loadClient();
  }

  async invoke(input: MessageInput): Promise<AIMessage> {
    const { text, raw } = await this.generateContent(input);
    return new AIMessage({
      content: text,
      response_metadata: { raw },
    });
  }

  withStructuredOutput<TSchema extends ZodTypeAny>(
    schema: TSchema,
    options?: { name?: string; method?: string; responseSchema?: Record<string, unknown> },
  ): {
    invoke: (input: MessageInput) => Promise<ReturnType<TSchema['parse']>>;
  } {
    return {
      invoke: async (input: MessageInput) => {
        const { text } = await this.generateContent(input, {
          responseMimeType: 'application/json',
          responseSchema: options?.responseSchema,
        });
        const parsed = this.safeJsonParse(text);
        return schema.parse(parsed);
      },
    };
  }

  private async generateContent(
    input: MessageInput,
    overrides?: GenerationOverrides,
  ): Promise<{ text: string; raw: unknown }> {
    const contents = this.normalizeInput(input);
    const generationConfig = this.buildGenerationConfig(overrides);
    const client = await this.clientPromise;

    const configPayload =
      overrides?.responseSchema !== undefined
        ? {
            ...(generationConfig ?? {}),
            responseSchema: overrides.responseSchema,
          }
        : generationConfig;

    const response = await client.models.generateContent({
      model: this.options.model,
      contents,
      config: configPayload,
      safetySettings: this.options.safetySettings,
    });

    return {
      text: this.extractResponseText(response),
      raw: response,
    };
  }

  private normalizeInput(input: MessageInput): Content[] {
    if (typeof input === 'string') {
      return [
        {
          role: 'user',
          parts: [{ text: input }],
        },
      ];
    }

    if (Array.isArray(input)) {
      return input.map((message) => this.messageToContent(message));
    }

    if (isBaseMessage(input)) {
      return [this.messageToContent(input)];
    }

    // Handle PromptValue input (from PromptTemplate)
    if (input && typeof input === 'object' && 'toString' in input) {
      // PromptValue has toString() and toMessages() methods
      if (typeof input.toString === 'function') {
        const stringValue = input.toString();
        return [
          {
            role: 'user',
            parts: [{ text: stringValue }],
          },
        ];
      }
    }

    throw new Error('Unsupported message input type for Vertex Chat model.');
  }

  private messageToContent(message: BaseMessage): Content {
    const type = message.getType();
    let role: string = 'user';
    if (type === 'ai') {
      role = 'model';
    } else if (type === 'system') {
      role = 'system';
    }

    return {
      role,
      parts: this.messageContentToParts(message.content),
    };
  }

  private messageContentToParts(content: BaseMessage['content']): Part[] {
    if (typeof content === 'string') {
      return [{ text: content }];
    }

    if (!Array.isArray(content)) {
      return [{ text: String(content ?? '') }];
    }

    const parts: Part[] = [];

    for (const entry of content) {
      if (!entry) {
        continue;
      }

      if (typeof entry === 'string') {
        parts.push({ text: entry });
        continue;
      }

      if (entry.type === 'text' || !entry.type) {
        parts.push({ text: (entry as { text?: string }).text ?? '' });
        continue;
      }

      if (entry.type === 'media') {
        const mediaPart = entry as { data?: string; mimeType?: string };
        if (mediaPart.data) {
          parts.push({
            inlineData: {
              data: mediaPart.data,
              mimeType: mediaPart.mimeType ?? 'application/octet-stream',
            },
          });
        }
        continue;
      }

      if (entry.type === 'image_url') {
        const imagePart = entry as {
          image_url:
            | string
            | {
                url: string;
                detail?: unknown;
              };
        };

        const url =
          typeof imagePart.image_url === 'string'
            ? imagePart.image_url
            : imagePart.image_url?.url;

        if (url) {
          parts.push({
            fileData: {
              fileUri: url,
            },
          });
        }
        continue;
      }

      parts.push({ text: JSON.stringify(entry) });
    }

    return parts;
  }

  private buildGenerationConfig(
    overrides?: GenerationOverrides,
  ): Record<string, unknown> | undefined {
    const config: Record<string, unknown> = {};

    const temperature = overrides?.temperature ?? this.options.temperature;
    if (typeof temperature === 'number') {
      config.temperature = temperature;
    }

    const maxOutputTokens =
      overrides?.maxOutputTokens ?? this.options.maxOutputTokens;
    if (typeof maxOutputTokens === 'number') {
      config.maxOutputTokens = maxOutputTokens;
    }

    const topP = overrides?.topP ?? this.options.topP;
    if (typeof topP === 'number') {
      config.topP = topP;
    }

    const topK = overrides?.topK ?? this.options.topK;
    if (typeof topK === 'number') {
      config.topK = topK;
    }

    const stopSequences =
      overrides?.stopSequences ?? this.options.stopSequences;
    if (Array.isArray(stopSequences) && stopSequences.length > 0) {
      config.stopSequences = stopSequences;
    }

    if (overrides?.responseMimeType) {
      config.responseMimeType = overrides.responseMimeType;
    }

    return Object.keys(config).length > 0 ? config : undefined;
  }

  private extractResponseText(response: any): string {
    const candidates = response?.response?.candidates ?? response?.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return '';
    }

    const parts = candidates[0]?.content?.parts;
    if (!Array.isArray(parts)) {
      return '';
    }

    return parts
      .map((part: Part) => {
        if (typeof (part as any).text === 'string') {
          return (part as any).text;
        }
        if ((part as any).inlineData?.data) {
          return (part as any).inlineData.data;
        }
        return '';
      })
      .join('');
  }

  private safeJsonParse(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch (error) {
      throw new Error(
        `Structured output parsing 실패: ${value.slice(0, 200)}...`,
      );
    }
  }

  private async loadClient(): Promise<any> {
    const module = await import('@google/genai');
    const { GoogleGenAI } = module;
    return new GoogleGenAI({
      vertexai: this.options.vertexai ?? true,
      project: this.options.project,
      location: this.options.location,
      apiVersion: this.options.apiVersion,
      googleAuthOptions: this.options.authOptions,
    });
  }
}
