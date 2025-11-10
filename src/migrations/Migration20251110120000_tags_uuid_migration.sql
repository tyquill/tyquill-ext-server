-- Migration: Tags PK from Serial Integer to UUID
-- Date: 2025-11-10
-- Description: Migrates tags table to UUID while preserving legacy IDs

-- ============================================================================
-- FORWARD MIGRATION (UP)
-- ============================================================================

-- 1. Ensure UUID extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TAGS TABLE MIGRATION
-- ============================================================================

-- 2. Add new UUID column and legacy ID column to tags
ALTER TABLE tags
  ADD COLUMN tag_uuid UUID DEFAULT uuid_generate_v4(),
  ADD COLUMN legacy_tag_id INTEGER;

-- 3. Copy existing IDs to legacy column
UPDATE tags SET legacy_tag_id = tag_id;

-- 4. Create sequence for auto-incrementing legacy IDs
CREATE SEQUENCE IF NOT EXISTS tags_legacy_tag_id_seq;
SELECT setval('tags_legacy_tag_id_seq', COALESCE((SELECT MAX(legacy_tag_id) FROM tags), 0));

-- 5. Set default for legacy_tag_id to use sequence
ALTER TABLE tags ALTER COLUMN legacy_tag_id SET DEFAULT nextval('tags_legacy_tag_id_seq');

-- 6. Add unique constraint on legacy_tag_id
ALTER TABLE tags ADD CONSTRAINT tags_legacy_tag_id_unique UNIQUE (legacy_tag_id);

-- 7. Drop existing foreign key constraints
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_user_id_foreign CASCADE;
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_user_id_fkey CASCADE;
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_scrap_id_foreign CASCADE;
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_scrap_id_fkey CASCADE;
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_article_id_foreign CASCADE;
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_article_id_fkey CASCADE;

-- 8. Drop primary key constraint
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_pkey CASCADE;

-- 9. Drop the old tag_id column
ALTER TABLE tags DROP COLUMN tag_id;

-- 10. Rename tag_uuid to tag_id
ALTER TABLE tags RENAME COLUMN tag_uuid TO tag_id;

-- 11. Add primary key constraint on new UUID column
ALTER TABLE tags ADD PRIMARY KEY (tag_id);

-- 12. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tags_legacy_tag_id ON tags(legacy_tag_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_scrap_id ON tags(scrap_id);
CREATE INDEX IF NOT EXISTS idx_tags_article_id ON tags(article_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- 13. Recreate foreign key constraints
ALTER TABLE tags
  ADD CONSTRAINT tags_user_id_foreign
  FOREIGN KEY (user_id) REFERENCES users(user_id)
  ON DELETE CASCADE;

ALTER TABLE tags
  ADD CONSTRAINT tags_scrap_id_foreign
  FOREIGN KEY (scrap_id) REFERENCES scraps(scrap_id)
  ON DELETE CASCADE;

ALTER TABLE tags
  ADD CONSTRAINT tags_article_id_foreign
  FOREIGN KEY (article_id) REFERENCES articles(article_id)
  ON DELETE CASCADE;

-- ============================================================================
-- DATA VALIDATION
-- ============================================================================

-- Verify all tags have UUIDs
DO $$
DECLARE
  null_uuid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_uuid_count FROM tags WHERE tag_id IS NULL;
  IF null_uuid_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % tags have NULL UUID', null_uuid_count;
  END IF;
  RAISE NOTICE 'Validation passed: All tags have UUIDs';
END $$;

-- Verify legacy IDs are unique
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT legacy_tag_id, COUNT(*)
    FROM tags
    WHERE legacy_tag_id IS NOT NULL
    GROUP BY legacy_tag_id
    HAVING COUNT(*) > 1
  ) duplicates;
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: Duplicate legacy_tag_id found';
  END IF;
  RAISE NOTICE 'Validation passed: All legacy IDs are unique';
END $$;

-- ============================================================================
-- ROLLBACK MIGRATION (DOWN)
-- ============================================================================
-- Run the following commands to rollback if needed:

/*
-- 1. Add integer tag_id column back
ALTER TABLE tags ADD COLUMN tag_id_int INTEGER;

-- 2. Populate with legacy IDs
UPDATE tags SET tag_id_int = legacy_tag_id;

-- 3. Drop foreign key constraints
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_user_id_foreign;
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_scrap_id_foreign;
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_article_id_foreign;

-- 4. Rename UUID column
ALTER TABLE tags RENAME COLUMN tag_id TO tag_uuid;

-- 5. Rename integer column to tag_id
ALTER TABLE tags RENAME COLUMN tag_id_int TO tag_id;

-- 6. Drop primary key on UUID
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_pkey;

-- 7. Add primary key on integer
ALTER TABLE tags ADD PRIMARY KEY (tag_id);

-- 8. Drop legacy columns and sequence
ALTER TABLE tags DROP COLUMN IF EXISTS tag_uuid;
ALTER TABLE tags DROP COLUMN IF EXISTS legacy_tag_id;
DROP SEQUENCE IF EXISTS tags_legacy_tag_id_seq;

-- 9. Drop UUID-related indexes
DROP INDEX IF EXISTS idx_tags_legacy_tag_id;

-- 10. Recreate foreign key constraints
ALTER TABLE tags
  ADD CONSTRAINT tags_user_id_foreign
  FOREIGN KEY (user_id) REFERENCES users(user_id)
  ON DELETE CASCADE;

ALTER TABLE tags
  ADD CONSTRAINT tags_scrap_id_foreign
  FOREIGN KEY (scrap_id) REFERENCES scraps(scrap_id)
  ON DELETE CASCADE;

ALTER TABLE tags
  ADD CONSTRAINT tags_article_id_foreign
  FOREIGN KEY (article_id) REFERENCES articles(article_id)
  ON DELETE CASCADE;

-- 11. Verify rollback
SELECT COUNT(*) as total_tags,
       COUNT(CASE WHEN tag_id IS NULL THEN 1 END) as null_ids
FROM tags;
*/
