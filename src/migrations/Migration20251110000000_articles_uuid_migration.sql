-- Migration: Articles and Article_Archive PK from Serial Integer to UUID
-- Date: 2025-11-10
-- Description: Migrates articles and article_archive tables to UUID while preserving legacy IDs

-- ============================================================================
-- FORWARD MIGRATION (UP)
-- ============================================================================

-- 1. Ensure UUID extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PART 1: ARTICLES TABLE MIGRATION
-- ============================================================================

-- 2. Add new UUID column and legacy ID column to articles
ALTER TABLE articles
  ADD COLUMN article_uuid UUID DEFAULT uuid_generate_v4(),
  ADD COLUMN legacy_article_id INTEGER;

-- 3. Copy existing IDs to legacy column
UPDATE articles SET legacy_article_id = article_id;

-- 4. Drop existing foreign key constraints from referencing tables
ALTER TABLE article_archive DROP CONSTRAINT IF EXISTS article_archive_article_id_foreign CASCADE;
ALTER TABLE article_archive DROP CONSTRAINT IF EXISTS article_archive_article_id_fkey CASCADE;

ALTER TABLE article_scraps DROP CONSTRAINT IF EXISTS article_scraps_article_id_foreign CASCADE;
ALTER TABLE article_scraps DROP CONSTRAINT IF EXISTS article_scraps_article_id_fkey CASCADE;

ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_article_id_foreign CASCADE;
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_article_id_fkey CASCADE;

-- 5. Add UUID columns to referencing tables
ALTER TABLE article_archive ADD COLUMN article_uuid UUID;
ALTER TABLE article_scraps ADD COLUMN article_uuid UUID;
ALTER TABLE tags ADD COLUMN article_uuid UUID;

-- 6. Map UUIDs from articles to referencing tables via legacy IDs
UPDATE article_archive aa
SET article_uuid = a.article_uuid
FROM articles a
WHERE aa.article_id = a.article_id;

UPDATE article_scraps as_
SET article_uuid = a.article_uuid
FROM articles a
WHERE as_.article_id = a.article_id;

UPDATE tags t
SET article_uuid = a.article_uuid
FROM articles a
WHERE t.article_id = a.article_id
  AND t.article_id IS NOT NULL;

-- 7. Drop old primary key constraint from articles
ALTER TABLE articles DROP CONSTRAINT articles_pkey CASCADE;

-- 8. Drop old article_id column and rename UUID column
ALTER TABLE articles DROP COLUMN article_id;
ALTER TABLE articles RENAME COLUMN article_uuid TO article_id;

-- 9. Add new primary key constraint with UUID
ALTER TABLE articles ADD PRIMARY KEY (article_id);

-- 10. Update referencing tables - rename UUID columns
ALTER TABLE article_archive DROP COLUMN article_id;
ALTER TABLE article_archive RENAME COLUMN article_uuid TO article_id;
ALTER TABLE article_archive ALTER COLUMN article_id SET NOT NULL;

ALTER TABLE article_scraps DROP COLUMN article_id;
ALTER TABLE article_scraps RENAME COLUMN article_uuid TO article_id;
ALTER TABLE article_scraps ALTER COLUMN article_id SET NOT NULL;

ALTER TABLE tags DROP COLUMN article_id;
ALTER TABLE tags RENAME COLUMN article_uuid TO article_id;
-- tags.article_id remains nullable

-- 11. Recreate foreign key constraints
ALTER TABLE article_archive
  ADD CONSTRAINT article_archive_article_id_fkey
  FOREIGN KEY (article_id) REFERENCES articles(article_id) ON DELETE CASCADE;

ALTER TABLE article_scraps
  ADD CONSTRAINT article_scraps_article_id_fkey
  FOREIGN KEY (article_id) REFERENCES articles(article_id) ON DELETE CASCADE;

ALTER TABLE tags
  ADD CONSTRAINT tags_article_id_fkey
  FOREIGN KEY (article_id) REFERENCES articles(article_id) ON DELETE CASCADE;

-- 12. Add unique constraint to legacy_article_id
ALTER TABLE articles ADD CONSTRAINT articles_legacy_article_id_unique UNIQUE (legacy_article_id);

-- 13. Create index on legacy_article_id for performance
CREATE INDEX idx_articles_legacy_article_id ON articles(legacy_article_id);

-- 14. Create sequence for legacy_article_id for new articles
CREATE SEQUENCE IF NOT EXISTS articles_legacy_article_id_seq;

-- 15. Set sequence to start after max existing legacy_article_id
SELECT setval('articles_legacy_article_id_seq', COALESCE((SELECT MAX(legacy_article_id) FROM articles), 0));

-- 16. Set default value for legacy_article_id to use sequence
ALTER TABLE articles ALTER COLUMN legacy_article_id SET DEFAULT nextval('articles_legacy_article_id_seq');

-- ============================================================================
-- PART 2: ARTICLE_ARCHIVE TABLE MIGRATION
-- ============================================================================

-- 17. Add UUID column and legacy ID to article_archive
ALTER TABLE article_archive
  ADD COLUMN article_archive_uuid UUID DEFAULT uuid_generate_v4(),
  ADD COLUMN legacy_article_archive_id INTEGER;

-- 18. Copy existing archive IDs to legacy column
UPDATE article_archive SET legacy_article_archive_id = article_archive_id;

-- 19. Drop old PK and rename UUID column
ALTER TABLE article_archive DROP CONSTRAINT article_archive_pkey CASCADE;
ALTER TABLE article_archive DROP COLUMN article_archive_id;
ALTER TABLE article_archive RENAME COLUMN article_archive_uuid TO article_archive_id;

-- 20. Add new primary key
ALTER TABLE article_archive ADD PRIMARY KEY (article_archive_id);

-- 21. Add unique constraint and index for legacy archive ID
ALTER TABLE article_archive ADD CONSTRAINT article_archive_legacy_id_unique UNIQUE (legacy_article_archive_id);
CREATE INDEX idx_article_archive_legacy_id ON article_archive(legacy_article_archive_id);

-- 22. Create sequence for legacy archive IDs
CREATE SEQUENCE IF NOT EXISTS article_archive_legacy_id_seq;
SELECT setval('article_archive_legacy_id_seq', COALESCE((SELECT MAX(legacy_article_archive_id) FROM article_archive), 0));
ALTER TABLE article_archive ALTER COLUMN legacy_article_archive_id SET DEFAULT nextval('article_archive_legacy_id_seq');

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify data integrity
SELECT
  'articles' as table_name,
  COUNT(*) as total_rows,
  COUNT(DISTINCT article_id) as unique_uuids,
  COUNT(DISTINCT legacy_article_id) as unique_legacy_ids
FROM articles
UNION ALL
SELECT
  'article_archive',
  COUNT(*),
  COUNT(DISTINCT article_archive_id),
  COUNT(DISTINCT legacy_article_archive_id)
FROM article_archive;

-- Check for orphaned relationships
SELECT 'Orphaned article_archive' as issue, COUNT(*) as count
FROM article_archive aa
LEFT JOIN articles a ON a.article_id = aa.article_id
WHERE a.article_id IS NULL
UNION ALL
SELECT 'Orphaned article_scraps', COUNT(*)
FROM article_scraps as_
LEFT JOIN articles a ON a.article_id = as_.article_id
WHERE a.article_id IS NULL
UNION ALL
SELECT 'Orphaned tags with article_id', COUNT(*)
FROM tags t
LEFT JOIN articles a ON a.article_id = t.article_id
WHERE t.article_id IS NOT NULL AND a.article_id IS NULL;

-- ============================================================================
-- ROLLBACK MIGRATION (DOWN)
-- ============================================================================

/*
-- Uncomment to rollback

-- 1. Drop foreign keys
ALTER TABLE article_archive DROP CONSTRAINT IF EXISTS article_archive_article_id_fkey CASCADE;
ALTER TABLE article_scraps DROP CONSTRAINT IF EXISTS article_scraps_article_id_fkey CASCADE;
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_article_id_fkey CASCADE;

-- 2. Add temporary integer columns
ALTER TABLE article_archive ADD COLUMN article_id_int INTEGER;
ALTER TABLE article_scraps ADD COLUMN article_id_int INTEGER;
ALTER TABLE tags ADD COLUMN article_id_int INTEGER;

-- 3. Map legacy IDs back
UPDATE article_archive aa
SET article_id_int = a.legacy_article_id
FROM articles a
WHERE aa.article_id = a.article_id;

UPDATE article_scraps as_
SET article_id_int = a.legacy_article_id
FROM articles a
WHERE as_.article_id = a.article_id;

UPDATE tags t
SET article_id_int = a.legacy_article_id
FROM articles a
WHERE t.article_id = a.article_id
  AND t.article_id IS NOT NULL;

-- 4. Restore articles table
ALTER TABLE articles DROP CONSTRAINT articles_pkey CASCADE;
ALTER TABLE articles RENAME COLUMN article_id TO article_uuid;
ALTER TABLE articles ADD COLUMN article_id INTEGER;
UPDATE articles SET article_id = legacy_article_id;
ALTER TABLE articles ALTER COLUMN article_id SET NOT NULL;
ALTER TABLE articles ADD PRIMARY KEY (article_id);

CREATE SEQUENCE IF NOT EXISTS articles_article_id_seq;
SELECT setval('articles_article_id_seq', (SELECT MAX(article_id) FROM articles));
ALTER TABLE articles ALTER COLUMN article_id SET DEFAULT nextval('articles_article_id_seq');

-- 5. Restore article_archive table
ALTER TABLE article_archive DROP CONSTRAINT article_archive_pkey CASCADE;
ALTER TABLE article_archive RENAME COLUMN article_archive_id TO article_archive_uuid;
ALTER TABLE article_archive ADD COLUMN article_archive_id INTEGER;
UPDATE article_archive SET article_archive_id = legacy_article_archive_id;
ALTER TABLE article_archive ALTER COLUMN article_archive_id SET NOT NULL;
ALTER TABLE article_archive ADD PRIMARY KEY (article_archive_id);

CREATE SEQUENCE IF NOT EXISTS article_archive_article_archive_id_seq;
SELECT setval('article_archive_article_archive_id_seq', (SELECT MAX(article_archive_id) FROM article_archive));
ALTER TABLE article_archive ALTER COLUMN article_archive_id SET DEFAULT nextval('article_archive_article_archive_id_seq');

-- 6. Restore referencing table columns
ALTER TABLE article_archive DROP COLUMN article_id;
ALTER TABLE article_archive RENAME COLUMN article_id_int TO article_id;
ALTER TABLE article_archive ALTER COLUMN article_id SET NOT NULL;

ALTER TABLE article_scraps DROP COLUMN article_id;
ALTER TABLE article_scraps RENAME COLUMN article_id_int TO article_id;
ALTER TABLE article_scraps ALTER COLUMN article_id SET NOT NULL;

ALTER TABLE tags DROP COLUMN article_id;
ALTER TABLE tags RENAME COLUMN article_id_int TO article_id;

-- 7. Recreate foreign keys
ALTER TABLE article_archive
  ADD CONSTRAINT article_archive_article_id_fkey
  FOREIGN KEY (article_id) REFERENCES articles(article_id) ON DELETE CASCADE;

ALTER TABLE article_scraps
  ADD CONSTRAINT article_scraps_article_id_fkey
  FOREIGN KEY (article_id) REFERENCES articles(article_id) ON DELETE CASCADE;

ALTER TABLE tags
  ADD CONSTRAINT tags_article_id_fkey
  FOREIGN KEY (article_id) REFERENCES articles(article_id) ON DELETE CASCADE;

-- 8. Cleanup
DROP INDEX IF EXISTS idx_articles_legacy_article_id;
DROP INDEX IF EXISTS idx_article_archive_legacy_id;
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_legacy_article_id_unique;
ALTER TABLE article_archive DROP CONSTRAINT IF EXISTS article_archive_legacy_id_unique;
ALTER TABLE articles DROP COLUMN legacy_article_id;
ALTER TABLE articles DROP COLUMN article_uuid;
ALTER TABLE article_archive DROP COLUMN legacy_article_archive_id;
ALTER TABLE article_archive DROP COLUMN article_archive_uuid;
DROP SEQUENCE IF EXISTS articles_legacy_article_id_seq;
DROP SEQUENCE IF EXISTS article_archive_legacy_id_seq;
*/
