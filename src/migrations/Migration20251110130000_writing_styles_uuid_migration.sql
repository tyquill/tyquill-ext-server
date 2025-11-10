-- Migration: WritingStyles & WritingStyleExamples PK from Serial Integer to UUID
-- Date: 2025-11-10
-- Description: Migrates writing_styles and writing_style_examples tables to UUID while preserving legacy IDs

-- ============================================================================
-- FORWARD MIGRATION (UP)
-- ============================================================================

-- 1. Ensure UUID extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- WRITING_STYLES TABLE MIGRATION
-- ============================================================================

-- 2. Add new UUID column and legacy ID column to writing_styles
ALTER TABLE writing_styles
  ADD COLUMN writing_style_uuid UUID DEFAULT uuid_generate_v4(),
  ADD COLUMN legacy_writing_style_id INTEGER;

-- 3. Copy existing IDs to legacy column
UPDATE writing_styles SET legacy_writing_style_id = id;

-- 4. Create sequence for auto-incrementing legacy IDs
CREATE SEQUENCE IF NOT EXISTS writing_styles_legacy_id_seq;
SELECT setval('writing_styles_legacy_id_seq', COALESCE((SELECT MAX(legacy_writing_style_id) FROM writing_styles), 0));

-- 5. Set default for legacy_writing_style_id to use sequence
ALTER TABLE writing_styles ALTER COLUMN legacy_writing_style_id SET DEFAULT nextval('writing_styles_legacy_id_seq');

-- 6. Add unique constraint on legacy_writing_style_id
ALTER TABLE writing_styles ADD CONSTRAINT writing_styles_legacy_id_unique UNIQUE (legacy_writing_style_id);

-- ============================================================================
-- WRITING_STYLE_EXAMPLES TABLE MIGRATION (Must happen before dropping writing_styles PK)
-- ============================================================================

-- 7. Add new UUID column and legacy ID column to writing_style_examples
ALTER TABLE writing_style_examples
  ADD COLUMN example_uuid UUID DEFAULT uuid_generate_v4(),
  ADD COLUMN legacy_example_id INTEGER;

-- 8. Copy existing IDs to legacy column
UPDATE writing_style_examples SET legacy_example_id = id;

-- 9. Create sequence for auto-incrementing legacy example IDs
CREATE SEQUENCE IF NOT EXISTS writing_style_examples_legacy_id_seq;
SELECT setval('writing_style_examples_legacy_id_seq', COALESCE((SELECT MAX(legacy_example_id) FROM writing_style_examples), 0));

-- 10. Set default for legacy_example_id to use sequence
ALTER TABLE writing_style_examples ALTER COLUMN legacy_example_id SET DEFAULT nextval('writing_style_examples_legacy_id_seq');

-- 11. Add unique constraint on legacy_example_id
ALTER TABLE writing_style_examples ADD CONSTRAINT writing_style_examples_legacy_id_unique UNIQUE (legacy_example_id);

-- ============================================================================
-- DROP FOREIGN KEY CONSTRAINTS (writing_style_examples -> writing_styles)
-- ============================================================================

-- 12. Drop foreign key constraint from writing_style_examples to writing_styles
ALTER TABLE writing_style_examples DROP CONSTRAINT IF EXISTS writing_style_examples_writing_style_id_foreign CASCADE;
ALTER TABLE writing_style_examples DROP CONSTRAINT IF EXISTS writing_style_examples_writing_style_id_fkey CASCADE;

-- ============================================================================
-- MIGRATE WRITING_STYLES PRIMARY KEY
-- ============================================================================

-- 13. Drop foreign key constraints on writing_styles
ALTER TABLE writing_styles DROP CONSTRAINT IF EXISTS writing_styles_user_id_foreign CASCADE;
ALTER TABLE writing_styles DROP CONSTRAINT IF EXISTS writing_styles_user_id_fkey CASCADE;

-- 14. Drop primary key constraint on writing_styles
ALTER TABLE writing_styles DROP CONSTRAINT IF EXISTS writing_styles_pkey CASCADE;

-- 15. Drop the old id column from writing_styles
ALTER TABLE writing_styles DROP COLUMN id;

-- 16. Rename writing_style_uuid to id
ALTER TABLE writing_styles RENAME COLUMN writing_style_uuid TO id;

-- 17. Add primary key constraint on new UUID column
ALTER TABLE writing_styles ADD PRIMARY KEY (id);

-- ============================================================================
-- MIGRATE WRITING_STYLE_EXAMPLES PRIMARY KEY
-- ============================================================================

-- 18. Drop primary key constraint on writing_style_examples
ALTER TABLE writing_style_examples DROP CONSTRAINT IF EXISTS writing_style_examples_pkey CASCADE;

-- 19. Drop the old id column from writing_style_examples
ALTER TABLE writing_style_examples DROP COLUMN id;

-- 20. Rename example_uuid to id
ALTER TABLE writing_style_examples RENAME COLUMN example_uuid TO id;

-- 21. Add primary key constraint on new UUID column
ALTER TABLE writing_style_examples ADD PRIMARY KEY (id);

-- ============================================================================
-- UPDATE FOREIGN KEY COLUMN IN WRITING_STYLE_EXAMPLES
-- ============================================================================

-- 22. Add new UUID foreign key column
ALTER TABLE writing_style_examples ADD COLUMN writing_style_id_uuid UUID;

-- 23. Populate new FK column by joining on legacy IDs
UPDATE writing_style_examples wse
SET writing_style_id_uuid = ws.id
FROM writing_styles ws
WHERE wse.writing_style_id = ws.legacy_writing_style_id;

-- 24. Drop old integer FK column
ALTER TABLE writing_style_examples DROP COLUMN writing_style_id;

-- 25. Rename UUID FK column to writing_style_id
ALTER TABLE writing_style_examples RENAME COLUMN writing_style_id_uuid TO writing_style_id;

-- 26. Set NOT NULL constraint on FK
ALTER TABLE writing_style_examples ALTER COLUMN writing_style_id SET NOT NULL;

-- ============================================================================
-- RECREATE INDEXES AND CONSTRAINTS
-- ============================================================================

-- 27. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_writing_styles_legacy_id ON writing_styles(legacy_writing_style_id);
CREATE INDEX IF NOT EXISTS idx_writing_styles_user_id ON writing_styles(user_id);
CREATE INDEX IF NOT EXISTS idx_writing_styles_name ON writing_styles(name);

CREATE INDEX IF NOT EXISTS idx_writing_style_examples_legacy_id ON writing_style_examples(legacy_example_id);
CREATE INDEX IF NOT EXISTS idx_writing_style_examples_writing_style_id ON writing_style_examples(writing_style_id);
CREATE INDEX IF NOT EXISTS idx_writing_style_examples_order ON writing_style_examples("order");

-- 28. Recreate foreign key constraints
ALTER TABLE writing_styles
  ADD CONSTRAINT writing_styles_user_id_foreign
  FOREIGN KEY (user_id) REFERENCES users(user_id)
  ON DELETE CASCADE;

ALTER TABLE writing_style_examples
  ADD CONSTRAINT writing_style_examples_writing_style_id_foreign
  FOREIGN KEY (writing_style_id) REFERENCES writing_styles(id)
  ON DELETE CASCADE;

-- ============================================================================
-- DATA VALIDATION
-- ============================================================================

-- Verify all writing_styles have UUIDs
DO $$
DECLARE
  null_uuid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_uuid_count FROM writing_styles WHERE id IS NULL;
  IF null_uuid_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % writing_styles have NULL UUID', null_uuid_count;
  END IF;
  RAISE NOTICE 'Validation passed: All writing_styles have UUIDs';
END $$;

-- Verify all writing_style_examples have UUIDs
DO $$
DECLARE
  null_uuid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_uuid_count FROM writing_style_examples WHERE id IS NULL;
  IF null_uuid_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % writing_style_examples have NULL UUID', null_uuid_count;
  END IF;
  RAISE NOTICE 'Validation passed: All writing_style_examples have UUIDs';
END $$;

-- Verify legacy IDs are unique for writing_styles
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT legacy_writing_style_id, COUNT(*)
    FROM writing_styles
    WHERE legacy_writing_style_id IS NOT NULL
    GROUP BY legacy_writing_style_id
    HAVING COUNT(*) > 1
  ) duplicates;
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: Duplicate legacy_writing_style_id found';
  END IF;
  RAISE NOTICE 'Validation passed: All writing_styles legacy IDs are unique';
END $$;

-- Verify legacy IDs are unique for writing_style_examples
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT legacy_example_id, COUNT(*)
    FROM writing_style_examples
    WHERE legacy_example_id IS NOT NULL
    GROUP BY legacy_example_id
    HAVING COUNT(*) > 1
  ) duplicates;
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: Duplicate legacy_example_id found';
  END IF;
  RAISE NOTICE 'Validation passed: All writing_style_examples legacy IDs are unique';
END $$;

-- Verify foreign key integrity
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM writing_style_examples wse
  LEFT JOIN writing_styles ws ON wse.writing_style_id = ws.id
  WHERE ws.id IS NULL;
  IF orphaned_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % orphaned writing_style_examples found', orphaned_count;
  END IF;
  RAISE NOTICE 'Validation passed: All writing_style_examples have valid writing_style_id';
END $$;

-- ============================================================================
-- ROLLBACK MIGRATION (DOWN)
-- ============================================================================
-- Run the following commands to rollback if needed:

/*
-- ROLLBACK: WRITING_STYLE_EXAMPLES TABLE

-- 1. Add integer ID column back
ALTER TABLE writing_style_examples ADD COLUMN id_int INTEGER;

-- 2. Populate with legacy IDs
UPDATE writing_style_examples SET id_int = legacy_example_id;

-- 3. Add integer FK column back
ALTER TABLE writing_style_examples ADD COLUMN writing_style_id_int INTEGER;

-- 4. Populate FK with writing_styles legacy IDs
UPDATE writing_style_examples wse
SET writing_style_id_int = ws.legacy_writing_style_id
FROM writing_styles ws
WHERE wse.writing_style_id = ws.id;

-- 5. Drop FK constraint
ALTER TABLE writing_style_examples DROP CONSTRAINT IF EXISTS writing_style_examples_writing_style_id_foreign;

-- 6. Rename UUID columns
ALTER TABLE writing_style_examples RENAME COLUMN id TO id_uuid;
ALTER TABLE writing_style_examples RENAME COLUMN writing_style_id TO writing_style_id_uuid;

-- 7. Rename integer columns to original names
ALTER TABLE writing_style_examples RENAME COLUMN id_int TO id;
ALTER TABLE writing_style_examples RENAME COLUMN writing_style_id_int TO writing_style_id;

-- 8. Drop primary key on UUID
ALTER TABLE writing_style_examples DROP CONSTRAINT IF EXISTS writing_style_examples_pkey;

-- 9. Add primary key on integer
ALTER TABLE writing_style_examples ADD PRIMARY KEY (id);

-- 10. Drop UUID columns and legacy columns
ALTER TABLE writing_style_examples DROP COLUMN IF EXISTS id_uuid;
ALTER TABLE writing_style_examples DROP COLUMN IF EXISTS writing_style_id_uuid;
ALTER TABLE writing_style_examples DROP COLUMN IF EXISTS legacy_example_id;
DROP SEQUENCE IF EXISTS writing_style_examples_legacy_id_seq;
DROP INDEX IF EXISTS idx_writing_style_examples_legacy_id;

-- ROLLBACK: WRITING_STYLES TABLE

-- 11. Add integer ID column back
ALTER TABLE writing_styles ADD COLUMN id_int INTEGER;

-- 12. Populate with legacy IDs
UPDATE writing_styles SET id_int = legacy_writing_style_id;

-- 13. Drop FK constraints
ALTER TABLE writing_styles DROP CONSTRAINT IF EXISTS writing_styles_user_id_foreign;

-- 14. Rename UUID column
ALTER TABLE writing_styles RENAME COLUMN id TO id_uuid;

-- 15. Rename integer column to id
ALTER TABLE writing_styles RENAME COLUMN id_int TO id;

-- 16. Drop primary key on UUID
ALTER TABLE writing_styles DROP CONSTRAINT IF EXISTS writing_styles_pkey;

-- 17. Add primary key on integer
ALTER TABLE writing_styles ADD PRIMARY KEY (id);

-- 18. Drop UUID columns and legacy columns
ALTER TABLE writing_styles DROP COLUMN IF EXISTS id_uuid;
ALTER TABLE writing_styles DROP COLUMN IF EXISTS legacy_writing_style_id;
DROP SEQUENCE IF EXISTS writing_styles_legacy_id_seq;
DROP INDEX IF EXISTS idx_writing_styles_legacy_id;

-- 19. Recreate foreign key constraints
ALTER TABLE writing_styles
  ADD CONSTRAINT writing_styles_user_id_foreign
  FOREIGN KEY (user_id) REFERENCES users(user_id)
  ON DELETE CASCADE;

ALTER TABLE writing_style_examples
  ADD CONSTRAINT writing_style_examples_writing_style_id_foreign
  FOREIGN KEY (writing_style_id) REFERENCES writing_styles(id)
  ON DELETE CASCADE;

-- 20. Verify rollback
SELECT COUNT(*) as total_styles,
       COUNT(CASE WHEN id IS NULL THEN 1 END) as null_ids
FROM writing_styles;

SELECT COUNT(*) as total_examples,
       COUNT(CASE WHEN id IS NULL THEN 1 END) as null_ids
FROM writing_style_examples;
*/
