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
  UseInterceptors,
  UploadedFile,
  Req,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as os from 'os';
import { Express } from 'express';
import { UploadedFilesService } from '../../uploaded-files/uploaded-files.service';
// import { CreateUploadedFileDto } from './dto/create-uploaded-file.dto';
import { UpdateUploadedFileDto } from './dto/update-uploaded-file.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

interface RetryAnalysisResponseDto {
  jobUuid: string | null;
  status: 'queued' | 'error';
  error?: string;
}

@Controller('uploaded-files')
export class UploadedFilesController {
  constructor(private readonly uploadedFilesService: UploadedFilesService) {}

  @Version('1')
  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => cb(null, os.tmpdir()),
      filename: (req, file, cb) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        cb(null, `${Date.now()}-${safe}`);
      },
    }),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit (adjust as needed)
    fileFilter: (req, file, cb) => {
      if (file.mimetype !== 'application/pdf') {
        return cb(null, false);
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
      throw new Error('File is required');
    }

    return this.uploadedFilesService.uploadToS3AndSave(
      file,
      body.title || file.originalname.replace(/\.[^/.]+$/, ''),
      body.description || '',
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
    return this.uploadedFilesService.findOne(+id, req.user.id);
  }

  @Version('1')
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Req() req: any, @Param('id') id: string, @Body() updateUploadedFileDto: UpdateUploadedFileDto) {
    return this.uploadedFilesService.update(+id, updateUploadedFileDto, req.user.id);
  }

  @Version('1')
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Req() req: any, @Param('id') id: string) {
    this.uploadedFilesService.remove(+id, req.user.id);
    return { message: 'Uploaded file deleted successfully' };
  }

  @Version('1')
  @Get(':id/analysis')
  @UseGuards(JwtAuthGuard)
  async getAnalysis(@Req() req: any, @Param('id') id: string) {
    const data = await this.uploadedFilesService.getAnalysis(+id, req.user.id);
    return data;
  }

  @Version('1')
  @Post(':id/analysis/retry')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async retryAnalysis(
    @Req() req: any, 
    @Param('id', ParseIntPipe) id: number
  ): Promise<RetryAnalysisResponseDto> {
    return await this.uploadedFilesService.retryAnalysis(id, req.user.id);
  }
}
