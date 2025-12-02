import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
  Version,
  BadRequestException,
  Delete,
  Param,
  ParseEnumPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  LibraryItemsService,
  LibraryItemDto,
  LibraryItemType,
} from '../../library-items/library-items.service';
import { CreateScrapDto } from '../scraps/dto/create-scrap.dto';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';

enum LibraryItemTypeEnum {
  SCRAP = 'SCRAP',
  UPLOAD = 'UPLOAD',
}
@UseGuards(JwtAuthGuard)
@Controller('library-items')
export class LibraryItemsController {
  constructor(private readonly libraryItemsService: LibraryItemsService) {}

  @Version('1')
  @Get()
  async list(
    @Request() req: any,
    @Query('type', new ParseEnumPipe(LibraryItemTypeEnum))
    type?: LibraryItemType,
  ): Promise<LibraryItemDto[]> {
    const userId = req.user.id;
    return this.libraryItemsService.list(userId, type);
  }

  @Version('1')
  @Post('scrap')
  async createScrap(@Request() req: any, @Body() body: CreateScrapDto) {
    const userId = req.user.id;
    return this.libraryItemsService.createScrap(body, userId);
  }

  @Version('1')
  @Post('upload')
  async upload(@Request() req: any) {
    if (!req.isMultipart()) {
      throw new BadRequestException('Multipart request expected');
    }

    const parts = req.parts();
    let fileInfo: any = null;
    const fields: any = {};

    for await (const part of parts) {
      if (part.type === 'file') {
        if (fileInfo) continue;

        if (part.mimetype !== 'application/pdf') {
          throw new BadRequestException('Only PDF files are supported');
        }

        const safeName = part.filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const tmpPath = path.join(os.tmpdir(), `${Date.now()}-${safeName}`);
        await pipeline(part.file, fs.createWriteStream(tmpPath));

        fileInfo = {
          fieldname: part.fieldname,
          originalname: part.filename,
          encoding: part.encoding,
          mimetype: part.mimetype,
          path: tmpPath,
          size: fs.statSync(tmpPath).size,
        };
      } else {
        fields[part.fieldname] = part.value;
      }
    }

    if (!fileInfo) {
      throw new BadRequestException('File is required');
    }

    const userId = req.user.id;
    try {
      return await this.libraryItemsService.uploadViaS3(fileInfo, fields, userId);
    } finally {
      // 임시 파일 정리 (에러가 발생하더라도 실행)
      if (fileInfo?.path && fs.existsSync(fileInfo.path)) {
        fs.promises.unlink(fileInfo.path).catch((error) => {
          console.warn(`Failed to delete temporary file: ${fileInfo.path}`, error);
        });
      }
    }
  }

  @Version('1')
  @Post(':itemId/tags')
  async addTag(
    @Param('itemId') itemId: string,
    @Query('type', new ParseEnumPipe(LibraryItemTypeEnum))
    type: LibraryItemType,
    @Body() body: { name: string },
    @Request() req: any,
  ) {
    const userId = req.user.id;
    return this.libraryItemsService.addTag(
      itemId,
      type,
      body.name,
      userId,
    );
  }

  @Version('1')
  @Delete(':itemId/tags/:tagId')
  async removeTag(
    @Param('itemId') itemId: string,
    @Param('tagId') tagId: string,
    @Query('type', new ParseEnumPipe(LibraryItemTypeEnum))
    type: LibraryItemType,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    await this.libraryItemsService.removeTag(
      itemId,
      type,
      tagId,
      userId,
    );
    return {
      success: true,
      message: 'Tag removed from item successfully',
      deletedTagId: tagId,
    };
  }

  @Version('1')
  @Get(':itemId/tags')
  async getTags(
    @Param('itemId') itemId: string,
    @Query('type', new ParseEnumPipe(LibraryItemTypeEnum))
    type: LibraryItemType,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    return this.libraryItemsService.getTags(itemId, type, userId);
  }
}
