-- Migration: ArticleScrap PK from Integer to UUID
-- Date: 2025-11-10
-- Description: Updates article_scraps.article_scrap_id from serial integer to UUID PK

-- ============================================================================
-- FORWARD MIGRATION (UP)
-- ============================================================================

-- Step 1: Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 2: Add new UUID column
ALTER TABLE article_scraps
  ADD COLUMN article_scrap_uuid UUID DEFAULT uuid_generate_v4();

-- Step 3: Drop existing primary key constraint
ALTER TABLE article_scraps DROP CONSTRAINT IF EXISTS article_scraps_pkey CASCADE;

-- Step 4: Drop old integer column
ALTER TABLE article_scraps DROP COLUMN article_scrap_id;

-- Step 5: Rename UUID column to article_scrap_id
ALTER TABLE article_scraps RENAME COLUMN article_scrap_uuid TO article_scrap_id;

-- Step 6: Set new UUID column as primary key
ALTER TABLE article_scraps ADD PRIMARY KEY (article_scrap_id);

-- ============================================================================
-- DATA VALIDATION
-- ============================================================================

-- Verify all records have UUID primary keys
DO $$
DECLARE
  invalid_uuids INTEGER;
BEGIN
  -- Check for invalid UUIDs (cast to text for regex check)
  SELECT COUNT(*) INTO invalid_uuids
  FROM article_scraps
  WHERE article_scrap_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  IF invalid_uuids > 0 THEN
    RAISE EXCEPTION 'Migration failed: % records have invalid UUID format', invalid_uuids;
  END IF;

  RAISE NOTICE 'Validation passed: All article_scraps records migrated successfully';
END $$;

-- Display migration summary
DO $$
DECLARE
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM article_scraps;

  RAISE NOTICE '=== Migration Summary ===';
  RAISE NOTICE 'Total article_scraps records: %', total_count;
  RAISE NOTICE 'All records now use UUID primary keys';
END $$;

-- ============================================================================
-- ROLLBACK MIGRATION (DOWN)
-- ============================================================================
-- Run the following commands to rollback if needed:

/*
-- Note: ArticleScrap is a junction table that is never queried by ID directly.
-- Rollback requires recreating all article-scrap associations from scratch.
-- This migration is irreversible in practice - recommend database restore from backup.

-- If rollback is absolutely necessary:
-- 1. Backup current article_scraps data
-- 2. Drop article_scraps table
-- 3. Recreate with integer PK
-- 4. Manually restore associations based on (article_id, scrap_id) unique constraint
*/
