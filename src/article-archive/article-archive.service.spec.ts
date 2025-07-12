import { Test, TestingModule } from '@nestjs/testing';
import { ArticleArchiveService } from './article-archive.service';

describe('ArticleArchiveService', () => {
  let service: ArticleArchiveService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ArticleArchiveService],
    }).compile();

    service = module.get<ArticleArchiveService>(ArticleArchiveService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
