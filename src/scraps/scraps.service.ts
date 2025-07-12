import { Injectable } from '@nestjs/common';
import { CreateScrapDto } from '../api/scraps/dto/create-scrap.dto';
import { UpdateScrapDto } from '../api/scraps/dto/update-scrap.dto';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { Scrap } from './entities/scrap.entity';
import { InjectRepository } from '@mikro-orm/nestjs';
import { User } from '../users/entities/user.entity';
import { Article } from '../articles/entities/article.entity';

@Injectable()
export class ScrapsService {

  constructor(
    private readonly em: EntityManager,
    @InjectRepository(Scrap)
    private readonly scrapRepository: EntityRepository<Scrap>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    @InjectRepository(Article)
    private readonly articleRepository: EntityRepository<Article>,
  ) {}

  async create(createScrapDto: CreateScrapDto, userId: number, articleId?: number): Promise<Scrap> {
    const user = await this.userRepository.findOne({ userId });
    if (!user) {
      throw new Error('User not found');
    }

    const article = articleId ? await this.articleRepository.findOne({ articleId }) : null;
    const scrap = new Scrap();
    Object.assign(scrap, createScrapDto);
    scrap.user = user;
    if (article) {
      scrap.article = article;
    }
    
    await this.em.persistAndFlush(scrap);
    return scrap;
  }

  async findAll(userId?: number): Promise<Scrap[]> {
    const query = userId 
      ? { user: { userId } }
      : {};
    
    return await this.scrapRepository.find(query, {
      populate: ['user', 'article', 'tags']
    });
  }

  async findOne(scrapId: number): Promise<Scrap | null> {
    return await this.scrapRepository.findOne({ scrapId }, {
      populate: ['user', 'article', 'tags']
    });
  }

  async findByUser(userId: number): Promise<Scrap[]> {
    return await this.scrapRepository.find(
      { user: { userId } },
      { populate: ['user', 'article', 'tags'] }
    );
  }

  async findByArticle(articleId: number): Promise<Scrap[]> {
    return await this.scrapRepository.find(
      { article: { articleId } },
      { populate: ['user', 'article', 'tags'] }
    );
  }

  async update(scrapId: number, updateScrapDto: UpdateScrapDto): Promise<Scrap | null> {
    const scrap = await this.scrapRepository.findOne({ scrapId });
    if (!scrap) {
      return null;
    }
    Object.assign(scrap, updateScrapDto);
    await this.em.flush();
    return scrap;
  }

  async remove(scrapId: number): Promise<void> {
    const scrap = await this.scrapRepository.findOne({ scrapId });
    if (scrap) {
      await this.em.removeAndFlush(scrap);
    }
  }

  async search(query: string, userId?: number): Promise<Scrap[]> {
    const qb = this.em.createQueryBuilder(Scrap, 's');
    
    qb.where({
      $or: [
        { title: { $ilike: `%${query}%` } },
        { content: { $ilike: `%${query}%` } },
        { userComment: { $ilike: `%${query}%` } }
      ]
    });

    if (userId) {
      qb.andWhere({ user: { userId } });
    }

    qb.leftJoinAndSelect('s.user', 'u')
      .leftJoinAndSelect('s.article', 'a')
      .leftJoinAndSelect('s.tags', 't');

    return await qb.getResult();
  }
}
