import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { UsersService } from '../users.service';

@Injectable()
export class UserIdParamPipe implements PipeTransform {
  constructor(private readonly usersService: UsersService) {}

  async transform(
    value: string | number | undefined,
  ): Promise<string | undefined> {
    if (value === null || value === undefined || `${value}`.trim() === '') {
      return undefined;
    }

    const canonical = await this.usersService.resolveCanonicalUserId(value, {
      throwOnNotFound: false,
    });

    if (!canonical) {
      throw new BadRequestException('Invalid user identifier');
    }

    return canonical;
  }
}
