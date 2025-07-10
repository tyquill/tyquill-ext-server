import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ScrapsService } from './scraps.service';
import { CreateScrapDto } from './dto/create-scrap.dto';
import { UpdateScrapDto } from './dto/update-scrap.dto';

@Controller('scraps')
export class ScrapsController {
  constructor(private readonly scrapsService: ScrapsService) {}

  @Post()
  create(@Body() createScrapDto: CreateScrapDto) {
    return this.scrapsService.create(createScrapDto);
  }

  @Get()
  findAll() {
    return this.scrapsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.scrapsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateScrapDto: UpdateScrapDto) {
    return this.scrapsService.update(+id, updateScrapDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.scrapsService.remove(+id);
  }
}
