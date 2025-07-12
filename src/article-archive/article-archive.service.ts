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

  async create(createArticleArchiveDto: CreateArticleArchiveDto) {
    const articleArchive = new ArticleArchive();
    Object.assign(articleArchive, createArticleArchiveDto);
    await this.em.persistAndFlush(articleArchive);
    return articleArchive;
  }

  async findAll() {
    const articleArchives = await this.articleArchiveRepository.findAll();
    return articleArchives;
  }

  async findOne(id: number) {
    const articleArchive = await this.articleArchiveRepository.findOne({ articleArchiveId: id });
    if (!articleArchive) {
      return null;
    }
    return articleArchive;
  }

  async update(id: number, updateArticleArchiveDto: UpdateArticleArchiveDto) {
    const articleArchive = await this.articleArchiveRepository.findOne({ articleArchiveId: id });
    if (!articleArchive) {
      return null;
    }
    Object.assign(articleArchive, updateArticleArchiveDto);
    await this.em.flush();
    return articleArchive;
  }

  async remove(id: number) {
    const articleArchive = await this.articleArchiveRepository.findOne({ articleArchiveId: id });
    if (articleArchive) {
      await this.em.removeAndFlush(articleArchive);
    }
  }
}
