import { Injectable } from '@nestjs/common';
import { CreateArticleDto } from '../api/articles/dto/create-article.dto';
import { UpdateArticleDto } from '../api/articles/dto/update-article.dto';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Article } from './entities/article.entity';
import { EntityManager, EntityRepository } from '@mikro-orm/core';

@Injectable()
export class ArticlesService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(Article)
    private readonly articleRepository: EntityRepository<Article>,
  ) {}

  async create(createArticleDto: CreateArticleDto) {
    const article = Article.fromCreateArticleDto(createArticleDto);
    this.articleRepository.create(article);
    await this.em.persistAndFlush(article);
    return article;
  }

  findAll() {
    return this.articleRepository.findAll();
  }

  findOne(id: number) {
    return this.articleRepository.findOne({ articleId: id });
  }

  update(id: number, updateArticleDto: UpdateArticleDto) {
    return `This action updates a #${id} article`;
  }

  remove(id: number) {
    const article = this.articleRepository.findOne({ articleId: id });
    this.em.removeAndFlush(article);
    return article;
  }
}
