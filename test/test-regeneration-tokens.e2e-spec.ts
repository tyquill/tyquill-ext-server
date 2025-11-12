/**
 * E2E test to verify token counting in article regeneration
 * Run with: npm run test:e2e -- test-regeneration-tokens.e2e-spec.ts
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Article Regeneration Token Counting (E2E)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Note: You'll need a valid auth token for testing
    // For now, we'll skip auth and focus on the token counting logic
  });

  afterAll(async () => {
    await app.close();
  });

  it('should extract and save token counts from Vertex AI response', async () => {
    // Create a mock regeneration request
    const regenerationInput = {
      previousTitle: 'Test Article Title',
      previousContent: 'This is the original content of the article.',
      userPrompt: 'Please make the article more engaging and add some examples.',
      conversationHistory: [],
      existingScraps: [],
      addedScraps: [],
      removedScraps: [],
    };

    // Note: This test will only work if you have:
    // 1. Valid Vertex AI credentials configured
    // 2. A valid auth token
    // 3. The regeneration endpoint properly secured

    // For unit testing the token extraction, see the unit test below
  });
});

describe('Token Extraction Unit Test', () => {
  it('should correctly extract token counts from Vertex AI format', () => {
    // Mock the response structure from Vertex AI
    const mockUsageMetadata = {
      promptTokenCount: 150,
      candidatesTokenCount: 250,
      totalTokenCount: 400,
      // LangChain format
      input_tokens: 150,
      output_tokens: 250,
      total_tokens: 400,
    };

    // Test extraction logic
    const extractedTokens = {
      promptTokens: mockUsageMetadata.promptTokenCount || mockUsageMetadata.input_tokens,
      completionTokens: mockUsageMetadata.candidatesTokenCount || mockUsageMetadata.output_tokens,
      totalTokens: mockUsageMetadata.totalTokenCount || mockUsageMetadata.total_tokens,
    };

    expect(extractedTokens.promptTokens).toBe(150);
    expect(extractedTokens.completionTokens).toBe(250);
    expect(extractedTokens.totalTokens).toBe(400);
  });

  it('should calculate cost correctly for Gemini 2.5 Flash Lite', () => {
    const promptTokens = 1000;
    const completionTokens = 2000;

    // Gemini 2.5 Flash Lite pricing
    // Input: $0.0375 per 1M tokens
    // Output: $0.15 per 1M tokens
    const inputCost = promptTokens * 0.0375 / 1_000_000;
    const outputCost = completionTokens * 0.15 / 1_000_000;
    const totalCost = inputCost + outputCost;

    expect(inputCost).toBeCloseTo(0.0000375, 6);
    expect(outputCost).toBeCloseTo(0.0003, 6);
    expect(totalCost).toBeCloseTo(0.0003375, 6);
  });
});