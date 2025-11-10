-- Migration: Articles writing_style_id FK from Integer to UUID
-- Date: 2025-11-10
-- Description: Updates articles.writing_style_id FK to reference writing_styles UUID PK

-- ============================================================================
-- FORWARD MIGRATION (UP)
-- ============================================================================

-- 1. Add temporary UUID column for writing_style_id
ALTER TABLE articles ADD COLUMN writing_style_id_uuid UUID;

-- 2. Populate new UUID column by joining with writing_styles legacy IDs
UPDATE articles a
SET writing_style_id_uuid = ws.id
FROM writing_styles ws
WHERE a.writing_style_id = ws.legacy_writing_style_id;

-- 3. Drop old FK constraint if exists
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_writing_style_id_foreign CASCADE;
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_writing_style_id_fkey CASCADE;

-- 4. Drop old integer column
ALTER TABLE articles DROP COLUMN writing_style_id;

-- 5. Rename UUID column to writing_style_id
ALTER TABLE articles RENAME COLUMN writing_style_id_uuid TO writing_style_id;

-- 6. Recreate FK constraint to writing_styles UUID PK
ALTER TABLE articles
  ADD CONSTRAINT articles_writing_style_id_foreign
  FOREIGN KEY (writing_style_id) REFERENCES writing_styles(id)
  ON DELETE SET NULL;

-- 7. Create index for performance
CREATE INDEX IF NOT EXISTS idx_articles_writing_style_id ON articles(writing_style_id);

-- ============================================================================
-- DATA VALIDATION
-- ============================================================================

-- Verify no orphaned writing_style_id references
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM articles a
  LEFT JOIN writing_styles ws ON a.writing_style_id = ws.id
  WHERE a.writing_style_id IS NOT NULL AND ws.id IS NULL;

  IF orphaned_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % articles have orphaned writing_style_id', orphaned_count;
  END IF;

  RAISE NOTICE 'Validation passed: All articles have valid writing_style_id references';
END $$;

-- ============================================================================
-- ROLLBACK MIGRATION (DOWN)
-- ============================================================================
-- Run the following commands to rollback if needed:

/*
-- 1. Add integer column back
ALTER TABLE articles ADD COLUMN writing_style_id_int INTEGER;

-- 2. Populate with legacy IDs
UPDATE articles a
SET writing_style_id_int = ws.legacy_writing_style_id
FROM writing_styles ws
WHERE a.writing_style_id = ws.id;

-- 3. Drop FK constraint
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_writing_style_id_foreign;

-- 4. Drop UUID column
ALTER TABLE articles DROP COLUMN writing_style_id;

-- 5. Rename integer column to writing_style_id
ALTER TABLE articles RENAME COLUMN writing_style_id_int TO writing_style_id;

-- 6. Recreate FK constraint to integer PK (if needed - assuming old schema)
-- Note: This may fail if writing_styles no longer has integer PK
-- ALTER TABLE articles
--   ADD CONSTRAINT articles_writing_style_id_foreign
--   FOREIGN KEY (writing_style_id) REFERENCES writing_styles(id)
--   ON DELETE SET NULL;

-- 7. Drop UUID index
DROP INDEX IF EXISTS idx_articles_writing_style_id;

-- 8. Verify rollback
SELECT COUNT(*) as total_articles,
       COUNT(writing_style_id) as articles_with_style
FROM articles;
*/
