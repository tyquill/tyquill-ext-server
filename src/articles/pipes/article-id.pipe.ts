import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ArticlesService } from '../articles.service';

/**
 * Pipe to validate and normalize article identifiers (UUID or legacy numeric ID)
 * This pipe converts incoming article IDs to their canonical UUID form
 */
@Injectable()
export class ArticleIdParamPipe implements PipeTransform {
  constructor(private readonly articlesService: ArticlesService) {}

  async transform(
    value: string | number | undefined,
  ): Promise<string | undefined> {
    if (value === null || value === undefined || `${value}`.trim() === '') {
      return undefined;
    }

    const canonical = await this.articlesService.resolveCanonicalArticleId(
      value,
      {
        throwOnNotFound: false,
      },
    );

    if (!canonical) {
      throw new BadRequestException('Invalid article identifier');
    }

    return canonical;
  }
}
