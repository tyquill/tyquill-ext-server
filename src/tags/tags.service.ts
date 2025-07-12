import { Injectable } from '@nestjs/common';
import { CreateTagDto } from '../api/tags/dto/create-tag.dto';
import { UpdateTagDto } from '../api/tags/dto/update-tag.dto';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { Tag } from './entities/tag.entity';
import { User } from '../users/entities/user.entity';
import { Scrap } from '../scraps/entities/scrap.entity';

@Injectable()
export class TagsService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(Tag)
    private readonly tagRepository: EntityRepository<Tag>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    @InjectRepository(Scrap)
    private readonly scrapRepository: EntityRepository<Scrap>,
  ) {}

  async create(createTagDto: CreateTagDto, userId: number, scrapKey: number): Promise<Tag> {
    const user = await this.userRepository.findOne({ userId });
    if (!user) {
      throw new Error('User not found');
    }

    const scrap = await this.scrapRepository.findOne({ scrapId: scrapKey });
    if (!scrap) {
      throw new Error('Scrap not found');
    }

    const tag = new Tag();
    Object.assign(tag, createTagDto);
    tag.user = user;
    tag.scrap = scrap;
    
    await this.em.persistAndFlush(tag);
    return tag;
  }

  async findAll(userId?: number): Promise<Tag[]> {
    const query = userId 
      ? { user: { userId } }
      : {};
    
    return await this.tagRepository.find(query, {
      populate: ['user', 'scrap']
    });
  }

  async findOne(tagId: number): Promise<Tag | null> {
    return await this.tagRepository.findOne({ tagId }, {
      populate: ['user', 'scrap']
    });
  }

  async findByUser(userId: number): Promise<Tag[]> {
    return await this.tagRepository.find(
      { user: { userId } },
      { populate: ['user', 'scrap'] }
    );
  }

  async findByScrap(scrapKey: number): Promise<Tag[]> {
    return await this.tagRepository.find(
      { scrap: { scrapId: scrapKey } },
      { populate: ['user', 'scrap'] }
    );
  }

  async findByUserAndScrap(userId: number, scrapKey: number): Promise<Tag[]> {
    return await this.tagRepository.find(
      { 
        user: { userId },
        scrap: { scrapId: scrapKey }
      },
      { populate: ['user', 'scrap'] }
    );
  }

  async update(tagId: number, updateTagDto: UpdateTagDto): Promise<Tag | null> {
    const tag = await this.tagRepository.findOne({ tagId });
    if (!tag) {
      return null;
    }
    Object.assign(tag, updateTagDto);
    await this.em.flush();
    return tag;
  }

  async remove(tagId: number): Promise<void> {
    const tag = await this.tagRepository.findOne({ tagId });
    if (tag) {
      await this.em.removeAndFlush(tag);
    }
  }

  async removeFromScrap(userId: number, scrapKey: number, tagId: number): Promise<void> {
    const tag = await this.tagRepository.findOne({
      tagId,
      user: { userId },
      scrap: { scrapId: scrapKey }
    });
    
    if (tag) {
      await this.em.removeAndFlush(tag);
    }
  }

  async getTagsByName(userId: number, name: string): Promise<Tag[]> {
    return await this.tagRepository.find(
      { 
        user: { userId },
        name: { $ilike: `%${name}%` }
      },
      { populate: ['scrap'] }
    );
  }

  async getUniqueTagNames(userId: number): Promise<string[]> {
    const qb = this.em.createQueryBuilder(Tag, 't');
    
    const result = await qb
      .select('DISTINCT t.name')
      .where({ user: { userId } })
      .getResult();
    
    return result.map(r => r.name);
  }
}
