import { Injectable } from '@nestjs/common';
import { CreateScrapDto } from './dto/create-scrap.dto';
import { UpdateScrapDto } from './dto/update-scrap.dto';

@Injectable()
export class ScrapsService {
  create(createScrapDto: CreateScrapDto) {
    return 'This action adds a new scrap';
  }

  findAll() {
    return `This action returns all scraps`;
  }

  findOne(id: number) {
    return `This action returns a #${id} scrap`;
  }

  update(id: number, updateScrapDto: UpdateScrapDto) {
    return `This action updates a #${id} scrap`;
  }

  remove(id: number) {
    return `This action removes a #${id} scrap`;
  }
}
