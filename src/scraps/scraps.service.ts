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
    this.scrapRepository.create(scrap);
    return scrap;
  }

  findAll() {
    return this.scrapRepository.findAll();
  }

  findOne(id: number) {
    const scrap = this.scrapRepository.findOne({ scrapId: id });
    return scrap;
  }

  update(id: number, updateScrapDto: UpdateScrapDto) {
    const scrap = this.scrapRepository.findOne({ scrapId: id });
    Object.assign(scrap, updateScrapDto);
    return scrap;
  }

  remove(id: number) {
    this.em.remove(this.scrapRepository.findOne({ scrapId: id }));
  }
}
