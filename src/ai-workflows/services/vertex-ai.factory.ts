import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GoogleAuthOptions } from 'google-auth-library';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { ChatVertexAI } from '@langchain/google-vertexai';

@Injectable()
export class VertexAiFactory {
  private readonly logger = new Logger(VertexAiFactory.name);
  private readonly location: string;
  private readonly apiVersion: string;
  private readonly projectId?: string;
  private readonly authOptions?: GoogleAuthOptions;

  constructor(private readonly configService: ConfigService) {
    this.location =
      this.configService.get<string>('GOOGLE_VERTEX_LOCATION') ?? 'us-central1';
    this.apiVersion =
      this.configService.get<string>('GOOGLE_VERTEX_API_VERSION') ?? 'v1';
    this.projectId = this.configService.get<string>('GOOGLE_VERTEX_PROJECT_ID');
    this.authOptions = this.loadCredentials();
  }

  private loadCredentials(): GoogleAuthOptions | undefined {
    let credentialsJson =
      this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS_JSON');

    if (!credentialsJson) {
      const credentialsPath =
        this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS_PATH');

      if (credentialsPath) {
        try {
          const resolved = resolve(process.cwd(), credentialsPath);
          credentialsJson = readFileSync(resolved, 'utf8');
          this.logger.log(
            `Loaded Vertex credentials from GOOGLE_APPLICATION_CREDENTIALS_PATH (${resolved})`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to read credentials file at path "${credentialsPath}"`,
            error as Error,
          );
          throw error;
        }
      }
    }

    if (!credentialsJson) {
      const defaultPath = resolve(process.cwd(), 'credentials.json');
      if (existsSync(defaultPath)) {
        try {
          credentialsJson = readFileSync(defaultPath, 'utf8');
          this.logger.log(
            `Loaded Vertex credentials from default credentials.json at ${defaultPath}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to read default credentials.json at ${defaultPath}`,
            error as Error,
          );
          throw error;
        }
      }
    }

    if (!credentialsJson) {
      this.logger.warn(
        'Vertex credentials not provided; falling back to Application Default Credentials.',
      );
      return undefined;
    }

    try {
      const parsed = JSON.parse(credentialsJson);
      const projectId = parsed.project_id as string | undefined;

      const options: GoogleAuthOptions = {
        credentials: parsed,
        projectId,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      };

      this.logger.log(
        `Vertex AI credentials loaded for project ${projectId ?? 'unknown'}`,
      );

      return options;
    } catch (error) {
      this.logger.error('Failed to parse Vertex credentials JSON', error as Error);
      throw error;
    }
  }

  buildChat(params: {
    model: string;
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    thinkingBudget?: number; // Custom parameter (ignored for now, can be added via modelKwargs)
    responseMimeType?: string;
  }): ChatVertexAI {
    const chatParams: any = {
      model: params.model,
      location: this.location,
      temperature: params.temperature,
      maxOutputTokens: params.maxOutputTokens,
      topP: params.topP,
      topK: params.topK,
      // Explicitly disable API key - Vertex AI requires service account auth
      apiKey: undefined,
    };

    // Add auth options if available
    if (this.authOptions) {
      chatParams.authOptions = this.authOptions;
    }

    // Add project ID if available
    if (this.projectId ?? this.authOptions?.projectId) {
      chatParams.project = this.projectId ?? this.authOptions?.projectId;
    }

    // Add responseMimeType if specified (for JSON mode)
    if (params.responseMimeType) {
      chatParams.responseMimeType = params.responseMimeType;
    }

    // Add thinkingBudget via modelKwargs if specified
    if (params.thinkingBudget !== undefined) {
      chatParams.modelKwargs = {
        thinking_config: {
          thinking_budget: params.thinkingBudget,
        },
      };
    }

    return new ChatVertexAI(chatParams);
  }
}
