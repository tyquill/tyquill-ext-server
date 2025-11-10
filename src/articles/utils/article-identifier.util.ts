import { FilterQuery } from '@mikro-orm/core';
import { Article } from '../entities/article.entity';

export type ArticleIdentifier = string | number;
export type ArticleIdentifierLike = ArticleIdentifier | null | undefined;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}

export function normalizeArticleIdentifier(
  value: ArticleIdentifierLike,
): ArticleIdentifier | undefined {
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

  throw new Error(`Invalid article identifier: ${value}`);
}

export function ensureArticleIdentifier(
  value: ArticleIdentifierLike,
): ArticleIdentifier {
  const normalized = normalizeArticleIdentifier(value);
  if (normalized === undefined) {
    throw new Error('Article identifier is required');
  }
  return normalized;
}

export function buildArticleFilterFromInput(
  value: ArticleIdentifierLike,
): FilterQuery<Article> {
  return buildArticleWhere(ensureArticleIdentifier(value));
}

export function buildArticleWhere(
  identifier: ArticleIdentifier,
): FilterQuery<Article> {
  if (typeof identifier === 'string') {
    if (!isUuid(identifier)) {
      throw new Error(`Invalid UUID string: ${identifier}`);
    }
    return { articleId: identifier.toLowerCase() };
  }

  if (!Number.isInteger(identifier)) {
    throw new Error(`Legacy article ID must be an integer: ${identifier}`);
  }

  return { legacyArticleId: identifier };
}
