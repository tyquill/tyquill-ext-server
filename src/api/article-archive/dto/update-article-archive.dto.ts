import { PartialType } from '@nestjs/mapped-types';
import { CreateArticleArchiveDto } from './create-article-archive.dto';

export class UpdateArticleArchiveDto extends PartialType(CreateArticleArchiveDto) {}
