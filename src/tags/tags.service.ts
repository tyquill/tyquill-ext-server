import { Injectable } from '@nestjs/common';
import { CreateTagDto } from '../api/tags/dto/create-tag.dto';
import { UpdateTagDto } from '../api/tags/dto/update-tag.dto';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { Tag } from './entities/tag.entity';

@Injectable()
export class TagsService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(Tag)
    private readonly tagRepository: EntityRepository<Tag>,
  ) {}

  async create(createTagDto: CreateTagDto): Promise<Tag> {
    const tag = new Tag();
    Object.assign(tag, createTagDto);
    await this.em.persistAndFlush(tag);
    return tag;
  }

  async findAll(): Promise<Tag[]> {
    return await this.tagRepository.findAll();
  }

  async findOne(id: number) {
    const tag = await this.tagRepository.findOne({ tagId: id });

    return tag ?? null;
  }

  async update(id: number, updateTagDto: UpdateTagDto) {
    const tag: Tag | null = await this.tagRepository.findOne({ tagId: id });
    if (!tag) {
      return null;
    }
    Object.assign(tag, updateTagDto);
    await this.em.flush();
  }

  async remove(id: number) {
    const tag = await this.tagRepository.findOne({ tagId: id });
    if (tag) {
      await this.em.removeAndFlush(tag);
    }
  }
}
