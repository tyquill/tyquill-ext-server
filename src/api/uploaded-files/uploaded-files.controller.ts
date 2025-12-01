import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Version,
  Req,
  BadRequestException,
} from '@nestjs/common';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { UploadedFilesService } from '../../uploaded-files/uploaded-files.service';
// import { CreateUploadedFileDto } from './dto/create-uploaded-file.dto';
import { UpdateUploadedFileDto } from './dto/update-uploaded-file.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('uploaded-files')
export class UploadedFilesController {
  constructor(private readonly uploadedFilesService: UploadedFilesService) {}

  @Version('1')
  @Post('upload')
  @UseGuards(JwtAuthGuard)
  async upload(@Request() req: any) {
    if (!req.isMultipart()) {
      throw new BadRequestException('Multipart request expected');
    }

    const parts = req.parts();
    let fileInfo: any = null;
    const fields: any = {};

    for await (const part of parts) {
      if (part.type === 'file') {
        if (fileInfo) continue; // Only process the first file

        if (part.mimetype !== 'application/pdf') {
          throw new BadRequestException('Only PDF files are allowed');
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

    return this.uploadedFilesService.uploadToS3AndSave(
      fileInfo,
      fields.title || fileInfo.originalname.replace(/\.[^/.]+$/, ''),
      fields.description || '',
      req.user.id,
    );
  }

  // metadata-only create endpoint removed; use /uploaded-files/upload instead

  @Version('1')
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Request() req: any) {
    return this.uploadedFilesService.findAll(req.user.id);
  }

  @Version('1')
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.uploadedFilesService.findOne(id, req.user.id);
  }

  @Version('1')
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateUploadedFileDto: UpdateUploadedFileDto,
  ) {
    return this.uploadedFilesService.update(
      id,
      updateUploadedFileDto,
      req.user.id,
    );
  }

  @Version('1')
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Req() req: any, @Param('id') id: string) {
    this.uploadedFilesService.remove(id, req.user.id);
    return { message: 'Uploaded file deleted successfully' };
  }
}
