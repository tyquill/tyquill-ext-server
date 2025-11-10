/**
 * WritingStyle Identifier Utility
 *
 * Handles conversion and validation between UUID and legacy integer IDs for writing styles.
 * Supports backward compatibility with Chrome extension using integer IDs.
 */

import { FilterQuery } from '@mikro-orm/core';
import { WritingStyle } from '../entities/writing-style.entity';

/**
 * Type alias for writing style identifiers (UUID or legacy integer)
 */
export type WritingStyleIdentifier = string | number;
export type WritingStyleIdentifierLike =
  | WritingStyleIdentifier
  | null
  | undefined;

/**
 * Check if a string is a valid UUID
 */
export function isUuid(id: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Check if a string is a valid integer
 */
export function isInteger(id: string): boolean {
  return /^\d+$/.test(id) && !isNaN(parseInt(id, 10));
}

/**
 * Normalize writing style ID to string format
 * Handles both UUID and integer inputs
 */
export function normalizeWritingStyleId(
  id: WritingStyleIdentifierLike,
): string {
  if (id === null || id === undefined) {
    throw new Error('Writing style ID cannot be null or undefined');
  }

  if (typeof id === 'number') {
    return id.toString();
  }

  return id;
}

/**
 * Build MikroORM filter query for finding writing style by ID
 * Automatically detects UUID vs legacy integer ID
 *
 * @param id - WritingStyle identifier (UUID or legacy integer as string)
 * @returns FilterQuery object for MikroORM
 *
 * @example
 * // UUID lookup
 * buildWritingStyleWhereClause('550e8400-e29b-41d4-a716-446655440000')
 * // Returns: { id: '550e8400-e29b-41d4-a716-446655440000' }
 *
 * // Legacy integer lookup
 * buildWritingStyleWhereClause('123')
 * // Returns: { legacyWritingStyleId: 123 }
 */
export function buildWritingStyleWhereClause(
  id: string,
): FilterQuery<WritingStyle> {
  if (isUuid(id)) {
    return { id };
  }

  if (isInteger(id)) {
    return { legacyWritingStyleId: parseInt(id, 10) };
  }

  // If neither UUID nor integer, assume it's a malformed UUID and try anyway
  // This will fail at DB level with proper error message
  return { id };
}

/**
 * Validate writing style ID format
 *
 * @param id - WritingStyle identifier to validate
 * @returns true if valid UUID or integer
 */
export function isValidWritingStyleId(id: string): boolean {
  return isUuid(id) || isInteger(id);
}

/**
 * Get writing style identifier type for logging/debugging
 *
 * @param id - WritingStyle identifier
 * @returns 'uuid', 'legacy', or 'invalid'
 */
export function getWritingStyleIdType(
  id: string,
): 'uuid' | 'legacy' | 'invalid' {
  if (isUuid(id)) {
    return 'uuid';
  }

  if (isInteger(id)) {
    return 'legacy';
  }

  return 'invalid';
}
