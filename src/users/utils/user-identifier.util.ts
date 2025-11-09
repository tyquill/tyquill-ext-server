import { FilterQuery } from '@mikro-orm/core';
import { User } from '../entities/user.entity';

export type UserIdentifier = string | number;
export type UserIdentifierLike = UserIdentifier | null | undefined;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}

export function normalizeUserIdentifier(
  value: UserIdentifierLike,
): UserIdentifier | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'number') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (isUuid(trimmed)) {
    return trimmed.toLowerCase();
  }

  const parsed = Number(trimmed);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }

  throw new Error(`Invalid user identifier: ${value}`);
}

export function ensureUserIdentifier(
  value: UserIdentifierLike,
): UserIdentifier {
  const normalized = normalizeUserIdentifier(value);
  if (normalized === undefined) {
    throw new Error('User identifier is required');
  }
  return normalized;
}

export function buildUserFilterFromInput(
  value: UserIdentifierLike,
): FilterQuery<User> {
  return buildUserWhere(ensureUserIdentifier(value));
}

export function buildUserWhere(
  identifier: UserIdentifier,
): FilterQuery<User> {
  if (typeof identifier === 'string') {
    if (!isUuid(identifier)) {
      throw new Error(`Invalid UUID string: ${identifier}`);
    }
    return { userId: identifier.toLowerCase() };
  }

  if (!Number.isInteger(identifier)) {
    throw new Error(`Legacy user ID must be an integer: ${identifier}`);
  }

  return { legacyUserId: identifier };
}
