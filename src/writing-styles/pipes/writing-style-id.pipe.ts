/**
 * WritingStyle ID Parameter Pipe
 *
 * NestJS pipe for automatically validating and normalizing writing style IDs in route parameters.
 * Supports both UUID and legacy integer IDs for backward compatibility.
 *
 * @example
 * // In controller
 * @Get(':id')
 * async findOne(@Param('id', WritingStyleIdParamPipe) id: string) {
 *   // id is validated and normalized
 * }
 */

import {
  PipeTransform,
  Injectable,
  BadRequestException,
  ArgumentMetadata,
} from '@nestjs/common';
import {
  isValidWritingStyleId,
  normalizeWritingStyleId,
  getWritingStyleIdType,
} from '../utils/writing-style-identifier.util';

@Injectable()
export class WritingStyleIdParamPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (!value) {
      throw new BadRequestException('Writing style ID is required');
    }

    const normalizedId = normalizeWritingStyleId(value);

    if (!isValidWritingStyleId(normalizedId)) {
      throw new BadRequestException(
        `Invalid writing style ID format: "${value}". Expected UUID or integer.`,
      );
    }

    return normalizedId;
  }
}

/**
 * Optional variant that allows null/undefined values
 * Useful for optional query parameters
 */
@Injectable()
export class OptionalWritingStyleIdPipe
  implements PipeTransform<string, string | null>
{
  transform(value: string, metadata: ArgumentMetadata): string | null {
    if (!value) {
      return null;
    }

    const normalizedId = normalizeWritingStyleId(value);

    if (!isValidWritingStyleId(normalizedId)) {
      throw new BadRequestException(
        `Invalid writing style ID format: "${value}". Expected UUID or integer.`,
      );
    }

    return normalizedId;
  }
}
