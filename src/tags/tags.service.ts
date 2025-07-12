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

  create(createTagDto: CreateTagDto) {
    const tag = new Tag();
    Object.assign(tag, createTagDto);
    this.tagRepository.create(tag);
    this.em.persist(tag);
    this.em.flush();
    return tag;
  }

  findAll() {
    return this.tagRepository.findAll();
  }

  findOne(id: number) {
    return this.tagRepository.findOne({ tagId: id });
  }

  update(id: number, updateTagDto: UpdateTagDto) {
    const tag = this.tagRepository.findOne({ tagId: id });
    Object.assign(tag, updateTagDto);
    this.em.persist(tag);
    this.em.flush();
    return tag;
  }

  remove(id: number) {
    const tag = this.tagRepository.findOne({ tagId: id });
    this.em.removeAndFlush(tag);
  }
}
