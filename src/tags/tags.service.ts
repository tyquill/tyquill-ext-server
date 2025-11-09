import { Injectable } from '@nestjs/common';
import { CreateTagDto } from '../api/tags/dto/create-tag.dto';
import { UpdateTagDto } from '../api/tags/dto/update-tag.dto';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { Tag } from './entities/tag.entity';
import { User } from '../users/entities/user.entity';
import { Scrap } from '../scraps/entities/scrap.entity';
import {
  UserIdentifierLike,
  buildUserFilterFromInput,
  normalizeUserIdentifier,
} from '../users/utils/user-identifier.util';

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

  async create(
    createTagDto: CreateTagDto,
    userId: UserIdentifierLike,
    scrapId?: number,
  ): Promise<Tag> {
    const user = await this.userRepository.findOne(
      buildUserFilterFromInput(userId),
    );
    if (!user) {
      throw new Error('User not found');
    }

    const scrap = scrapId
      ? await this.scrapRepository.findOne({ scrapId, isDeleted: false })
      : null;
    if (scrapId && !scrap) {
      throw new Error('Scrap not found');
    }

    const tag = new Tag();
    Object.assign(tag, createTagDto);
    tag.user = user;
    if (scrap) {
      tag.scrap = scrap;
    }

    await this.em.persistAndFlush(tag);
    return tag;
  }

  async findAll(userId?: UserIdentifierLike): Promise<Tag[]> {
    const normalized = normalizeUserIdentifier(userId);
    const query =
      normalized !== undefined
        ? { user: buildUserFilterFromInput(normalized), isDeleted: false }
        : {};

    return await this.tagRepository.find(query, {
      populate: ['user', 'scrap'],
      filters: { isDeleted: false },
    });
  }

  async findOne(tagId: number): Promise<Tag | null> {
    return await this.tagRepository.findOne(
      { tagId },
      {
        populate: ['user', 'scrap'],
      },
    );
  }

  async findByUser(userId: UserIdentifierLike): Promise<Tag[]> {
    return await this.tagRepository.find(
      { user: buildUserFilterFromInput(userId) },
      { populate: ['user', 'scrap'] },
    );
  }

  async findByScrap(scrapId: number): Promise<Tag[]> {
    return await this.tagRepository.find(
      { scrap: { scrapId } },
      { populate: ['user', 'scrap'] },
    );
  }

  async findByUserAndScrap(
    userId: UserIdentifierLike,
    scrapId: number,
  ): Promise<Tag[]> {
    return await this.tagRepository.find(
      {
        user: buildUserFilterFromInput(userId),
        scrap: { scrapId },
      },
      { populate: ['user', 'scrap'], filters: { isDeleted: false } },
    );
  }

  async update(tagId: number, updateTagDto: UpdateTagDto): Promise<Tag | null> {
    const tag = await this.tagRepository.findOne({ tagId });
    if (!tag) {
      return null;
    }
    Object.assign(tag, updateTagDto);
    await this.em.persistAndFlush(tag);
    return tag;
  }

  async remove(tagId: number): Promise<void> {
    const tag = await this.tagRepository.findOne({ tagId });
    if (tag) {
      await this.em.removeAndFlush(tag);
    }
  }
  /**
   * 태그명으로 검색
   */
  async searchByName(
    name: string,
    userId?: UserIdentifierLike,
  ): Promise<Tag[]> {
    interface TagSearchQuery {
      name: { $ilike: string };
      user?: ReturnType<typeof buildUserFilterFromInput>;
      isDeleted?: boolean;
    }
    const query: TagSearchQuery = { name: { $ilike: `%${name}%` } };
    const normalized = normalizeUserIdentifier(userId);
    if (normalized !== undefined) {
      query.user = buildUserFilterFromInput(normalized);
    }

    return await this.tagRepository.find(query, {
      populate: ['user', 'scrap'],
    });
  }

  /**
   * 사용자별 고유 태그명 목록
   */
  async getUserTagNames(userId: UserIdentifierLike): Promise<string[]> {
    const qb = this.em.createQueryBuilder(Tag, 't');

    const result = await qb
      .select('DISTINCT t.name')
      .where({ user: buildUserFilterFromInput(userId) })
      .getResult();

    return result.map((r) => r.name);
  }

  // Legacy method names for backward compatibility
  async getTagsByName(
    userId: UserIdentifierLike,
    name: string,
  ): Promise<Tag[]> {
    return this.searchByName(name, userId);
  }

  async getUniqueTagNames(userId: UserIdentifierLike): Promise<string[]> {
    return this.getUserTagNames(userId);
  }
}
