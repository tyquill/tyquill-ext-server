import { Controller, Get, Post, Body, Patch, Param, Delete, Version } from '@nestjs/common';
import { ScrapsService } from '../../scraps/scraps.service';
import { CreateScrapDto } from './dto/create-scrap.dto';
import { UpdateScrapDto } from './dto/update-scrap.dto';

@Controller('scraps')
export class ScrapsController {
  constructor(private readonly scrapsService: ScrapsService) {}

  @Version('1')
  @Post()
  create(@Body() createScrapDto: CreateScrapDto) {
    return this.scrapsService.create(createScrapDto);
  }

  @Version('1')
  @Get()
  findAll() {
    return this.scrapsService.findAll();
  }

  @Version('1')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.scrapsService.findOne(+id);
  }

  @Version('1')
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateScrapDto: UpdateScrapDto) {
    return this.scrapsService.update(+id, updateScrapDto);
  }

  @Version('1')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.scrapsService.remove(+id);
  }
}
