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

  async create(createArticleDto: CreateArticleDto): Promise<Article> {
    const article = Article.fromCreateArticleDto(createArticleDto);
    await this.em.persistAndFlush(article);
    return article;
  }

  async findAll(): Promise<Article[]> {
    return await this.articleRepository.findAll();
  }

  async findOne(id: number): Promise<Article | null> {
    return await this.articleRepository.findOne({ articleId: id });
  }

  async update(id: number, updateArticleDto: UpdateArticleDto): Promise<Article | null> {
    const article = await this.articleRepository.findOne({ articleId: id });
    if (!article) {
      return null;
    }
    Object.assign(article, updateArticleDto);
    await this.em.flush();
    return article;
  }

  async remove(id: number): Promise<void> {
    const article = await this.articleRepository.findOne({ articleId: id });
    if (article) {
      await this.em.removeAndFlush(article);
    }
  }
}
