import { Test, TestingModule } from '@nestjs/testing';
import { ArticleArchiveController } from './article-archive.controller';
import { ArticleArchiveService } from '../../article-archive/article-archive.service';

describe('ArticleArchiveController', () => {
  let controller: ArticleArchiveController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArticleArchiveController],
      providers: [ArticleArchiveService],
    }).compile();

    controller = module.get<ArticleArchiveController>(ArticleArchiveController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
