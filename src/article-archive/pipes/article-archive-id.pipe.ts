import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ArticleArchiveService } from '../article-archive.service';

/**
 * Pipe to validate and normalize article archive identifiers (UUID or legacy numeric ID)
 * This pipe converts incoming article archive IDs to their canonical UUID form
 */
@Injectable()
export class ArticleArchiveIdParamPipe implements PipeTransform {
  constructor(
    private readonly articleArchiveService: ArticleArchiveService,
  ) {}

  async transform(
    value: string | number | undefined,
  ): Promise<string | undefined> {
    if (value === null || value === undefined || `${value}`.trim() === '') {
      return undefined;
    }

    const canonical =
      await this.articleArchiveService.resolveCanonicalArticleArchiveId(value, {
        throwOnNotFound: false,
      });

    if (!canonical) {
      throw new BadRequestException('Invalid article archive identifier');
    }

    return canonical;
  }
}
