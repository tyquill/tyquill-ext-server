import { Injectable } from '@nestjs/common';
import { CreateScrapDto } from '../api/scraps/dto/create-scrap.dto';
import { UpdateScrapDto } from '../api/scraps/dto/update-scrap.dto';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { Scrap } from './entities/scrap.entity';
import { InjectRepository } from '@mikro-orm/nestjs';

@Injectable()
export class ScrapsService {

  constructor(
    private readonly em: EntityManager,
    @InjectRepository(Scrap)
    private readonly scrapRepository: EntityRepository<Scrap>,
  ) {}

  async create(createScrapDto: CreateScrapDto): Promise<Scrap> {
    const scrap: Scrap = new Scrap();
    Object.assign(scrap, createScrapDto);
    await this.em.persistAndFlush(scrap);
    return scrap;
  }

  async findAll(): Promise<Scrap[]> {
    return await this.scrapRepository.findAll();
  }

  async findOne(id: number): Promise<Scrap | null> {
    return await this.scrapRepository.findOne({ scrapId: id });
  }

  async update(id: number, updateScrapDto: UpdateScrapDto): Promise<Scrap | null> {
    const scrap = await this.scrapRepository.findOne({ scrapId: id });
    if (!scrap) {
      return null;
    }
    Object.assign(scrap, updateScrapDto);
    await this.em.flush();
    return scrap;
  }

  async remove(id: number): Promise<void> {
    const scrap = await this.scrapRepository.findOne({ scrapId: id });
    if (scrap) {
      await this.em.removeAndFlush(scrap);
    }
  }
}
