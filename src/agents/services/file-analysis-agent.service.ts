import { Injectable, Logger } from '@nestjs/common';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { ChatVertexAI } from '../../ai-workflows/services/vertex-chat.model';

import { VertexAiFactory } from '../../ai-workflows/services/vertex-ai.factory';

@Injectable()
export class FileAnalysisAgentService {
  private readonly logger = new Logger(FileAnalysisAgentService.name);
  private readonly pdfModel: ChatVertexAI;

  constructor(vertexFactory: VertexAiFactory) {
    this.pdfModel = vertexFactory.buildChat({
      model: 'gemini-2.0-flash-lite',
      temperature: 0.3,
      thinkingBudget: 0,
    });
  }

  async analyzeFile(fileUrl: string): Promise<string> {
    this.logger.log(`📄 Analyzing file: ${fileUrl}`);

    const prompt =
      'You are a professional document analyst. Provide a concise markdown summary highlighting the main arguments, key data points, and actionable insights. Focus on content relevant to business and marketing contexts.';

    const message = await this.buildPdfMessage(prompt, fileUrl);
    const response = await this.pdfModel.invoke([message]);
    const text = this.extractMessageText(response);

    this.logger.log('✅ File analysis completed successfully');
    return text.trim();
  }

  private async buildPdfMessage(
    promptText: string,
    fileUrl: string,
  ): Promise<HumanMessage> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch(fileUrl, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(
          `Failed to download PDF from ${fileUrl}: HTTP ${response.status}`,
        );
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const maxSize = 10 * 1024 * 1024;
      if (buffer.byteLength > maxSize) {
        throw new Error('PDF file exceeds 10MB limit');
      }

      const base64 = buffer.toString('base64');
      return new HumanMessage({
        content: [
          { type: 'text', text: promptText },
          {
            type: 'media',
            mimeType: 'application/pdf',
            data: base64,
          },
        ],
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractMessageText(message: AIMessage | string): string {
    if (typeof message === 'string') {
      return message;
    }

    const content = message.content;

    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (!part) return '';
          if (typeof part === 'string') return part;
          if ('text' in part && part.text) {
            return String(part.text ?? '');
          }
          if ('content' in part && part.content) {
            return String(part.content ?? '');
          }
          return '';
        })
        .join('');
    }

    return '';
  }
}
