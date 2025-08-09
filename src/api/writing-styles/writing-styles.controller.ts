import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { WritingStylesService } from '../../writing-styles/writing-styles.service';
import { CreateWritingStyleDto } from './dto/create-writing-style.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { User } from '../../users/entities/user.entity';

@Controller('api/v1/writing-styles')
@UseGuards(JwtAuthGuard)
export class WritingStylesController {
  constructor(private readonly writingStylesService: WritingStylesService) {}

  @Post()
  create(
    @Body() createWritingStyleDto: CreateWritingStyleDto,
    @Req() req: any
  ) {
    const userId = parseInt(req.user.id); // JWT에서 사용자 ID 추출
    return this.writingStylesService.create(createWritingStyleDto, userId);
  }

  @Get()
  findAll(@Req() req: any) {
    const userId = parseInt(req.user.id); // JWT에서 사용자 ID 추출
    return this.writingStylesService.findAll(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    const userId = parseInt(req.user.id); // JWT에서 사용자 ID 추출
    return this.writingStylesService.findOne(+id, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    const userId = parseInt(req.user.id); // JWT에서 사용자 ID 추출 
    return this.writingStylesService.remove(+id, userId);
  }
}
