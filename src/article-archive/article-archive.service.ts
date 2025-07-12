import { Injectable } from '@nestjs/common';
import { CreateArticleArchiveDto } from '../api/article-archive/dto/create-article-archive.dto';
import { UpdateArticleArchiveDto } from '../api/article-archive/dto/update-article-archive.dto';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { ArticleArchive } from './entities/article-archive.entity';
import { InjectRepository } from '@mikro-orm/nestjs';

@Injectable()
export class ArticleArchiveService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(ArticleArchive)
    private readonly articleArchiveRepository: EntityRepository<ArticleArchive>,
  ) {}

  async create(createArticleArchiveDto: CreateArticleArchiveDto): Promise<ArticleArchive> {
    const articleArchive = new ArticleArchive();
    Object.assign(articleArchive, createArticleArchiveDto);
    await this.em.persistAndFlush(articleArchive);
    return articleArchive;
  }

  async findAll(): Promise<ArticleArchive[]> {
    return await this.articleArchiveRepository.findAll();
  }

  async findOne(id: number): Promise<ArticleArchive | null> {
    return await this.articleArchiveRepository.findOne({ articleArchiveId: id });
  }

  async update(id: number, updateArticleArchiveDto: UpdateArticleArchiveDto): Promise<ArticleArchive | null> {
    const articleArchive = await this.articleArchiveRepository.findOne({ articleArchiveId: id });
    if (!articleArchive) {
      return null;
    }
    Object.assign(articleArchive, updateArticleArchiveDto);
    await this.em.flush();
    return articleArchive;
  }

  async remove(id: number): Promise<void> {
    const articleArchive = await this.articleArchiveRepository.findOne({ articleArchiveId: id });
    if (articleArchive) {
      await this.em.removeAndFlush(articleArchive);
    }
  }
}
