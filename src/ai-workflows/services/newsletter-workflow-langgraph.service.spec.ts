import { Test, TestingModule } from '@nestjs/testing';
import { NewsletterWorkflowLanggraphService } from './newsletter-workflow-langgraph.service';
import { VertexAiFactory } from './vertex-ai.factory';
import { ScrapCombinationService } from './scrap-combination.service';
import { NewsletterPromptTemplatesService } from '../prompts/newsletter-prompt-templates.service';
import { NewsletterWorkflowInput } from '../dto/newsletter.dto';
import { ChatVertexAI } from '@langchain/google-vertexai';

describe('NewsletterWorkflowLanggraphService', () => {
  let service: NewsletterWorkflowLanggraphService;
  let vertexFactory: jest.Mocked<VertexAiFactory>;
  let scrapCombinationService: jest.Mocked<ScrapCombinationService>;
  let promptTemplates: jest.Mocked<NewsletterPromptTemplatesService>;

  // Mock ChatVertexAI
  const mockChatModel = {
    invoke: jest.fn(),
    withStructuredOutput: jest.fn(),
  } as unknown as ChatVertexAI;

  beforeEach(async () => {
    // Create mocks
    const mockVertexFactory = {
      buildChat: jest.fn().mockReturnValue(mockChatModel),
    };

    const mockScrapCombinationService = {
      formatForAiPromptWithComments: jest.fn().mockResolvedValue('Formatted scrap content'),
    };

    const mockPromptTemplates = {
      getSimpleNewsletterTemplate: jest.fn().mockReturnValue({
        format: jest.fn().mockResolvedValue('Newsletter prompt'),
      }),
      getKoreanNewsletterTemplate: jest.fn().mockReturnValue({
        format: jest.fn().mockResolvedValue('한국어 뉴스레터 프롬프트'),
      }),
      getSimpleNewsletterTitleTemplate: jest.fn().mockReturnValue({
        format: jest.fn().mockResolvedValue('Title prompt'),
      }),
      getKoreanNewsletterTitleTemplate: jest.fn().mockReturnValue({
        format: jest.fn().mockResolvedValue('한국어 제목 프롬프트'),
      }),
      getArticleReflectorTemplate: jest.fn().mockReturnValue({
        format: jest.fn().mockResolvedValue('Reflector prompt'),
      }),
      getKoreanArticleReflectorTemplate: jest.fn().mockReturnValue({
        format: jest.fn().mockResolvedValue('한국어 리플렉터 프롬프트'),
      }),
      getWritingStyleRewriteTemplate: jest.fn().mockReturnValue({
        format: jest.fn().mockResolvedValue('Writing style prompt'),
      }),
      getKoreanWritingStyleRewriteTemplate: jest.fn().mockReturnValue({
        format: jest.fn().mockResolvedValue('한국어 글쓰기 스타일 프롬프트'),
      }),
      getStructureAnalysisTemplate: jest.fn().mockReturnValue({
        format: jest.fn().mockResolvedValue('Structure analysis prompt'),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsletterWorkflowLanggraphService,
        {
          provide: VertexAiFactory,
          useValue: mockVertexFactory,
        },
        {
          provide: ScrapCombinationService,
          useValue: mockScrapCombinationService,
        },
        {
          provide: NewsletterPromptTemplatesService,
          useValue: mockPromptTemplates,
        },
      ],
    }).compile();

    service = module.get<NewsletterWorkflowLanggraphService>(
      NewsletterWorkflowLanggraphService,
    );
    vertexFactory = module.get(VertexAiFactory);
    scrapCombinationService = module.get(ScrapCombinationService);
    promptTemplates = module.get(NewsletterPromptTemplatesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createInitialState', () => {
    it('should create initial state with default values', () => {
      const input: NewsletterWorkflowInput = {
        topic: 'AI in Healthcare',
        keyInsight: 'AI is transforming diagnostics',
      };

      const state = service['createInitialState'](input);

      expect(state.topic).toBe('AI in Healthcare');
      expect(state.keyInsight).toBe('AI is transforming diagnostics');
      expect(state.userLanguage).toBe('en');
      expect(state.processingSteps).toEqual([]);
      expect(state.warnings).toEqual([]);
      expect(state.errors).toEqual([]);
      expect(state.countOfReflector).toBe(0);
    });

    it('should handle optional fields', () => {
      const input: NewsletterWorkflowInput = {
        topic: 'Test Topic',
        generationParams: 'Test params',
        articleStructureTemplate: [
          { title: 'Introduction', insight: 'Opening section' },
        ],
        writingStyleExampleContents: ['Example 1', 'Example 2'],
        userLanguage: 'ko',
      };

      const state = service['createInitialState'](input);

      expect(state.generationParams).toBe('Test params');
      expect(state.articleStructureTemplate).toHaveLength(1);
      expect(state.writingStyleExampleContents).toHaveLength(2);
      expect(state.userLanguage).toBe('ko');
    });
  });

  describe('prepareScrapContentNode', () => {
    it('should format scrap content when scraps are provided', async () => {
      const state = service['createInitialState']({
        topic: 'Test',
        scrapsWithComments: [
          {
            scrap: {
              id: 'scrap-1',
              url: 'https://example.com',
              title: 'Test Scrap',
              content: 'Test content',
            },
            userComment: 'Test comment',
          },
        ],
      });

      const update = await service['prepareScrapContentNode'](state);

      expect(update.scrapContent).toBe('Formatted scrap content');
      expect(update.processingSteps).toContain('scrap_content_preparation');
      expect(scrapCombinationService.formatForAiPromptWithComments).toHaveBeenCalled();
    });

    it('should handle empty scraps', async () => {
      const state = service['createInitialState']({
        topic: 'Test',
        scrapsWithComments: [],
      });

      const update = await service['prepareScrapContentNode'](state);

      expect(update.warnings).toContain('Scrap data is not provided.');
      expect(update.scrapContent).toContain('not provided');
    });

    it('should handle errors gracefully', async () => {
      scrapCombinationService.formatForAiPromptWithComments.mockRejectedValueOnce(
        new Error('Format error'),
      );

      const state = service['createInitialState']({
        topic: 'Test',
        scrapsWithComments: [
          {
            scrap: {
              id: 'scrap-1',
              url: 'https://example.com',
              title: 'Test',
              content: 'Test',
            },
            userComment: 'Test',
          },
        ],
      });

      const update = await service['prepareScrapContentNode'](state);

      expect(update.errors).toContain('Scrap data preparation error.');
      expect(update.warnings).toContain('Scrap data preparation error.');
    });
  });

  describe('determineNextNode', () => {
    it('should route to ARTICLE_REFLECTOR when iteration < 1', () => {
      const state = service['createInitialState']({
        topic: 'Test',
      });
      state.countOfReflector = 0;

      const next = service['determineNextNode'](state);

      expect(next).toBe('article_reflector');
    });

    it('should route to REWRITE_STYLE when has writing style examples', () => {
      const state = service['createInitialState']({
        topic: 'Test',
        writingStyleExampleContents: ['Example 1'],
      });
      state.countOfReflector = 1;

      const next = service['determineNextNode'](state);

      expect(next).toBe('rewrite_writing_style');
    });

    it('should route to GENERATE_TITLE otherwise', () => {
      const state = service['createInitialState']({
        topic: 'Test',
      });
      state.countOfReflector = 1;

      const next = service['determineNextNode'](state);

      expect(next).toBe('generate_newsletter_title');
    });
  });

  describe('generateNewsletter', () => {
    it('should execute workflow and return result', async () => {
      // Mock AI responses - simplified to always return consistent values
      (mockChatModel.invoke as jest.Mock).mockResolvedValue({
        content: 'Generated content'
      });

      const input: NewsletterWorkflowInput = {
        topic: 'AI in Healthcare',
        keyInsight: 'AI is transforming diagnostics',
        scrapsWithComments: [],
      };

      const result = await service.generateNewsletter(input);

      expect(result).toBeDefined();
      expect(result.title).toBeDefined();
      expect(result.title.length).toBeGreaterThan(0);
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.analysisReason).toBe('AI model generated newsletter.');
      // Workflow should invoke AI model multiple times (newsletter + reflector + newsletter + title)
      expect(mockChatModel.invoke).toHaveBeenCalled();
    }, 30000); // Increase timeout for workflow execution

    it('should handle workflow with warnings gracefully', async () => {
      // Even with empty scraps/pdfs, workflow should complete with warnings
      (mockChatModel.invoke as jest.Mock)
        .mockResolvedValueOnce({ content: 'Newsletter content' })
        .mockResolvedValueOnce({ content: 'Feedback' })
        .mockResolvedValueOnce({ content: 'Improved content' })
        .mockResolvedValueOnce({ content: 'Title' });

      const input: NewsletterWorkflowInput = {
        topic: 'Test',
        scrapsWithComments: [],
      };

      const result = await service.generateNewsletter(input);

      expect(result).toBeDefined();
      expect(result.warnings).toContain('Scrap data is not provided.');
      expect(result.warnings).toContain('PDF data is not provided.');
    }, 30000);
  });

  describe('streamNewsletter', () => {
    it('should stream workflow events', async () => {
      // Mock AI responses
      (mockChatModel.invoke as jest.Mock)
        .mockResolvedValueOnce({ content: 'Newsletter content' })
        .mockResolvedValueOnce({ content: 'Feedback' })
        .mockResolvedValueOnce({ content: 'Improved content' })
        .mockResolvedValueOnce({ content: 'Title' });

      const input: NewsletterWorkflowInput = {
        topic: 'Test Topic',
        scrapsWithComments: [],
      };

      const events: any[] = [];
      for await (const event of service.streamNewsletter(input)) {
        events.push(event);
        // Break after a few events to avoid long test
        if (events.length > 3) {
          break;
        }
      }

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty('event');
      expect(events[0]).toHaveProperty('data');
    }, 30000);
  });

  describe('extractMessageText', () => {
    it('should extract text from string', () => {
      const result = service['extractMessageText']('Simple text');
      expect(result).toBe('Simple text');
    });

    it('should extract text from AIMessage with string content', () => {
      const message = {
        content: 'Message content',
      } as any;

      const result = service['extractMessageText'](message);
      expect(result).toBe('Message content');
    });

    it('should extract text from AIMessage with array content', () => {
      const message = {
        content: [
          { type: 'text', text: 'Part 1' },
          { type: 'text', text: 'Part 2' },
        ],
      } as any;

      const result = service['extractMessageText'](message);
      expect(result).toBe('Part 1Part 2');
    });
  });

  describe('aggregatorNode', () => {
    it('should log content lengths', () => {
      const state = service['createInitialState']({
        topic: 'Test',
      });
      state.scrapContent = 'Scrap content';
      state.pdfContent = 'PDF content';

      const result = service['aggregatorNode'](state);

      expect(result).toEqual({});
    });
  });

  describe('analyzePageStructure', () => {
    it('should analyze page structure', async () => {
      const mockStructuredModel = {
        invoke: jest.fn().mockResolvedValue({
          sections: [
            { title: 'Introduction', level: 1, parent_index: null },
            { title: 'Section 1', level: 2, parent_index: 0 },
          ],
        }),
      };

      (mockChatModel.withStructuredOutput as jest.Mock).mockReturnValue(
        mockStructuredModel,
      );

      const result = await service.analyzePageStructure('# Test Content');

      expect(result).toBeDefined();
      expect(result.sections).toHaveLength(2);
      expect(result.sections[0].title).toBe('Introduction');
    });

    it('should fallback on error', async () => {
      (mockChatModel.withStructuredOutput as jest.Mock).mockImplementation(() => {
        throw new Error('Structured output failed');
      });

      (mockChatModel.invoke as jest.Mock).mockRejectedValue(
        new Error('Fallback failed'),
      );

      const result = await service.analyzePageStructure('# Test Content');

      expect(result).toBeDefined();
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].title).toBe('Document');
    });
  });
});
