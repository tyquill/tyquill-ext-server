import { FilterQuery } from '@mikro-orm/core';
import { ArticleArchive } from '../entities/article-archive.entity';

export type ArticleArchiveIdentifier = string | number;
export type ArticleArchiveIdentifierLike =
  | ArticleArchiveIdentifier
  | null
  | undefined;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}

export function normalizeArticleArchiveIdentifier(
  value: ArticleArchiveIdentifierLike,
): ArticleArchiveIdentifier | undefined {
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

  throw new Error(`Invalid article archive identifier: ${value}`);
}

export function ensureArticleArchiveIdentifier(
  value: ArticleArchiveIdentifierLike,
): ArticleArchiveIdentifier {
  const normalized = normalizeArticleArchiveIdentifier(value);
  if (normalized === undefined) {
    throw new Error('Article archive identifier is required');
  }
  return normalized;
}

export function buildArticleArchiveFilterFromInput(
  value: ArticleArchiveIdentifierLike,
): FilterQuery<ArticleArchive> {
  return buildArticleArchiveWhere(ensureArticleArchiveIdentifier(value));
}

export function buildArticleArchiveWhere(
  identifier: ArticleArchiveIdentifier,
): FilterQuery<ArticleArchive> {
  if (typeof identifier === 'string') {
    if (!isUuid(identifier)) {
      throw new Error(`Invalid UUID string: ${identifier}`);
    }
    return { articleArchiveId: identifier.toLowerCase() };
  }

  if (!Number.isInteger(identifier)) {
    throw new Error(
      `Legacy article archive ID must be an integer: ${identifier}`,
    );
  }

  return { legacyArticleArchiveId: identifier };
}
