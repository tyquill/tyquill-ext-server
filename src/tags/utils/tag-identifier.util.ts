/**
 * Tag Identifier Utility
 *
 * Handles conversion and validation between UUID and legacy integer IDs for tags.
 * Supports backward compatibility with Chrome extension using integer IDs.
 */

import { FilterQuery } from '@mikro-orm/core';
import { Tag } from '../entities/tag.entity';

/**
 * Check if a string is a valid UUID
 */
export function isUuid(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Check if a string is a valid integer
 */
export function isInteger(id: string): boolean {
  return /^\d+$/.test(id) && !isNaN(parseInt(id, 10));
}

/**
 * Normalize tag ID to string format
 * Handles both UUID and integer inputs
 */
export function normalizeTagId(id: string | number): string {
  if (typeof id === 'number') {
    return id.toString();
  }
  return id;
}

/**
 * Build MikroORM filter query for finding tag by ID
 * Automatically detects UUID vs legacy integer ID
 *
 * @param id - Tag identifier (UUID or legacy integer as string)
 * @returns FilterQuery object for MikroORM
 *
 * @example
 * // UUID lookup
 * buildTagWhereClause('550e8400-e29b-41d4-a716-446655440000')
 * // Returns: { tagId: '550e8400-e29b-41d4-a716-446655440000' }
 *
 * // Legacy integer lookup
 * buildTagWhereClause('123')
 * // Returns: { legacyTagId: 123 }
 */
export function buildTagWhereClause(id: string): FilterQuery<Tag> {
  const normalizedId = normalizeTagId(id);

  if (isUuid(normalizedId)) {
    return { tagId: normalizedId };
  }

  if (isInteger(normalizedId)) {
    return { legacyTagId: parseInt(normalizedId, 10) };
  }

  // If neither UUID nor integer, assume it's a malformed UUID and try anyway
  // This will fail at DB level with proper error message
  return { tagId: normalizedId };
}

/**
 * Validate tag ID format
 *
 * @param id - Tag identifier to validate
 * @returns true if valid UUID or integer
 */
export function isValidTagId(id: string): boolean {
  const normalizedId = normalizeTagId(id);
  return isUuid(normalizedId) || isInteger(normalizedId);
}

/**
 * Get tag identifier type for logging/debugging
 *
 * @param id - Tag identifier
 * @returns 'uuid', 'legacy', or 'invalid'
 */
export function getTagIdType(id: string): 'uuid' | 'legacy' | 'invalid' {
  const normalizedId = normalizeTagId(id);

  if (isUuid(normalizedId)) {
    return 'uuid';
  }

  if (isInteger(normalizedId)) {
    return 'legacy';
  }

  return 'invalid';
}
