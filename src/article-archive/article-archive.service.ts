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

  create(createArticleArchiveDto: CreateArticleArchiveDto) {
    const articleArchive = new ArticleArchive();
    this.articleArchiveRepository.create(articleArchive);
    this.em.persistAndFlush(articleArchive);
    return 'This action adds a new articleArchive';
  }

  findAll() {
    return this.articleArchiveRepository.findAll();
  }

  findOne(id: number) {
    return this.articleArchiveRepository.findOne({ articleArchiveId: id });
  }

  update(id: number, updateArticleArchiveDto: UpdateArticleArchiveDto) {
    return `This action updates a #${id} articleArchive`;
  }

  remove(id: number) {
    const articleArchive = this.articleArchiveRepository.findOne({ articleArchiveId: id });
    this.em.removeAndFlush(articleArchive)
    return `This action removes a #${id} articleArchive`;
  }
}
