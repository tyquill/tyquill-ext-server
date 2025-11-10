import { FilterQuery } from '@mikro-orm/core';
import { Scrap } from '../entities/scrap.entity';

export type ScrapIdentifier = string | number;
export type ScrapIdentifierLike = ScrapIdentifier | null | undefined;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}

export function normalizeScrapIdentifier(
  value: ScrapIdentifierLike,
): ScrapIdentifier | undefined {
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

  throw new Error(`Invalid scrap identifier: ${value}`);
}

export function ensureScrapIdentifier(
  value: ScrapIdentifierLike,
): ScrapIdentifier {
  const normalized = normalizeScrapIdentifier(value);
  if (normalized === undefined) {
    throw new Error('Scrap identifier is required');
  }
  return normalized;
}

export function buildScrapFilterFromInput(
  value: ScrapIdentifierLike,
): FilterQuery<Scrap> {
  return buildScrapWhere(ensureScrapIdentifier(value));
}

export function buildScrapWhere(
  identifier: ScrapIdentifier,
): FilterQuery<Scrap> {
  if (typeof identifier === 'string') {
    if (!isUuid(identifier)) {
      throw new Error(`Invalid UUID string: ${identifier}`);
    }
    return { scrapId: identifier.toLowerCase() };
  }

  if (!Number.isInteger(identifier)) {
    throw new Error(`Legacy scrap ID must be an integer: ${identifier}`);
  }

  return { legacyScrapId: identifier };
}
