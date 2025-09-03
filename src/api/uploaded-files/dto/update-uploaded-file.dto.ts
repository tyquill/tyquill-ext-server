import { PartialType } from '@nestjs/swagger';
import { CreateUploadedFileDto } from './create-uploaded-file.dto';

export class UpdateUploadedFileDto extends PartialType(CreateUploadedFileDto) {}
