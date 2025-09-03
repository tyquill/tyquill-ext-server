import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
  Version,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LibraryItemsService, LibraryItemDto, LibraryItemType } from '../../library-items/library-items.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateScrapDto } from '../scraps/dto/create-scrap.dto';
import { Param } from '@nestjs/common';

@UseGuards(JwtAuthGuard)
@Controller('library-items')
export class LibraryItemsController {
  constructor(private readonly libraryItemsService: LibraryItemsService) {}

  @Version('1')
  @Get()
  async list(
    @Request() req: any,
    @Query('type') type?: LibraryItemType,
  ): Promise<LibraryItemDto[]> {
    const userId = parseInt(req.user.id);
    return this.libraryItemsService.list(userId, type);
  }

  @Version('1')
  @Post('scrap')
  async createScrap(
    @Request() req: any,
    @Body() body: CreateScrapDto,
  ) {
    const userId = parseInt(req.user.id);
    return this.libraryItemsService.createScrap(body, userId);
  }

  @Version('1')
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit (adjust as needed)
    fileFilter: (req, file, cb) => {
      if (file.mimetype !== 'application/pdf') {
        return cb(new BadRequestException('Only PDF files are supported'), false);
      }
      cb(null, true);
    },
  }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { title?: string; description?: string },
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const userId = parseInt(req.user.id);
    return this.libraryItemsService.uploadViaS3(file, body, userId);
  }

}
