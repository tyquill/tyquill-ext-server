/**
 * Tag ID Parameter Pipe
 *
 * NestJS pipe for automatically validating and normalizing tag IDs in route parameters.
 * Supports both UUID and legacy integer IDs for backward compatibility.
 *
 * @example
 * // In controller
 * @Get(':tagId')
 * async findOne(@Param('tagId', TagIdParamPipe) tagId: string) {
 *   // tagId is validated and normalized
 * }
 */

import {
  PipeTransform,
  Injectable,
  BadRequestException,
  ArgumentMetadata,
} from '@nestjs/common';
import {
  isValidTagId,
  normalizeTagId,
  getTagIdType,
} from '../utils/tag-identifier.util';

@Injectable()
export class TagIdParamPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (!value) {
      throw new BadRequestException('Tag ID is required');
    }

    const normalizedId = normalizeTagId(value);

    if (!isValidTagId(normalizedId)) {
      throw new BadRequestException(
        `Invalid tag ID format: "${value}". Expected UUID or integer.`,
      );
    }

    const idType = getTagIdType(normalizedId);

    // Log for debugging (remove in production if needed)
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[TagIdParamPipe] Validated ${idType} tag ID: ${normalizedId}`,
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
export class OptionalTagIdPipe implements PipeTransform<string, string | null> {
  transform(value: string, metadata: ArgumentMetadata): string | null {
    if (!value) {
      return null;
    }

    const normalizedId = normalizeTagId(value);

    if (!isValidTagId(normalizedId)) {
      throw new BadRequestException(
        `Invalid tag ID format: "${value}". Expected UUID or integer.`,
      );
    }

    return normalizedId;
  }
}
