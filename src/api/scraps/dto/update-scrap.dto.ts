import { PartialType } from '@nestjs/mapped-types';
import { CreateScrapDto } from './create-scrap.dto';

export class UpdateScrapDto extends PartialType(CreateScrapDto) {}
