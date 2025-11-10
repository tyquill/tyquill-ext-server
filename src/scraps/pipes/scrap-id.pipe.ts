import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ScrapsService } from '../scraps.service';

@Injectable()
export class ScrapIdParamPipe implements PipeTransform {
  constructor(private readonly scrapsService: ScrapsService) {}

  async transform(
    value: string | number | undefined,
  ): Promise<string | undefined> {
    if (value === null || value === undefined || `${value}`.trim() === '') {
      return undefined;
    }

    const canonical = await this.scrapsService.resolveCanonicalScrapId(value, {
      throwOnNotFound: false,
    });

    if (!canonical) {
      throw new BadRequestException('Invalid scrap identifier');
    }

    return canonical;
  }
}
