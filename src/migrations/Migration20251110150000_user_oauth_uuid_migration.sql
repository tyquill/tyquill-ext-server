-- Migration: UserOAuth PK from Integer to UUID
-- Date: 2025-11-10
-- Description: Updates user_oauth.user_oauth_id from serial integer to UUID PK

-- ============================================================================
-- FORWARD MIGRATION (UP)
-- ============================================================================

-- Step 1: Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 2: Add new UUID column and legacy ID column
ALTER TABLE user_oauth
  ADD COLUMN user_oauth_uuid UUID DEFAULT uuid_generate_v4(),
  ADD COLUMN legacy_user_oauth_id INTEGER;

-- Step 3: Copy existing IDs to legacy column
UPDATE user_oauth SET legacy_user_oauth_id = user_oauth_id;

-- Step 4: Drop existing primary key constraint
ALTER TABLE user_oauth DROP CONSTRAINT IF EXISTS user_oauth_pkey CASCADE;

-- Step 5: Drop old integer column
ALTER TABLE user_oauth DROP COLUMN user_oauth_id;

-- Step 6: Rename UUID column to user_oauth_id
ALTER TABLE user_oauth RENAME COLUMN user_oauth_uuid TO user_oauth_id;

-- Step 7: Set new UUID column as primary key
ALTER TABLE user_oauth ADD PRIMARY KEY (user_oauth_id);

-- Step 8: Add unique constraint on legacy_user_oauth_id
ALTER TABLE user_oauth
  ADD CONSTRAINT user_oauth_legacy_user_oauth_id_unique
  UNIQUE (legacy_user_oauth_id);

-- Step 9: Create index for performance on legacy_user_oauth_id
CREATE INDEX IF NOT EXISTS idx_user_oauth_legacy_user_oauth_id
  ON user_oauth(legacy_user_oauth_id);

-- ============================================================================
-- DATA VALIDATION
-- ============================================================================

-- Verify all records have UUID primary keys
DO $$
DECLARE
  invalid_uuids INTEGER;
  null_legacy_ids INTEGER;
BEGIN
  -- Check for invalid UUIDs (cast to text for regex check)
  SELECT COUNT(*) INTO invalid_uuids
  FROM user_oauth
  WHERE user_oauth_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  IF invalid_uuids > 0 THEN
    RAISE EXCEPTION 'Migration failed: % records have invalid UUID format', invalid_uuids;
  END IF;

  -- Check for null legacy IDs
  SELECT COUNT(*) INTO null_legacy_ids
  FROM user_oauth
  WHERE legacy_user_oauth_id IS NULL;

  IF null_legacy_ids > 0 THEN
    RAISE EXCEPTION 'Migration failed: % records missing legacy_user_oauth_id', null_legacy_ids;
  END IF;

  RAISE NOTICE 'Validation passed: All user_oauth records migrated successfully';
END $$;

-- Display migration summary
DO $$
DECLARE
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM user_oauth;

  RAISE NOTICE '=== Migration Summary ===';
  RAISE NOTICE 'Total user_oauth records: %', total_count;
  RAISE NOTICE 'All records now use UUID primary keys';
  RAISE NOTICE 'Legacy integer IDs preserved in legacy_user_oauth_id column';
END $$;

-- ============================================================================
-- ROLLBACK MIGRATION (DOWN)
-- ============================================================================
-- Run the following commands to rollback if needed:

/*
-- Step 1: Add temporary integer column
ALTER TABLE user_oauth ADD COLUMN user_oauth_id_int INTEGER;

-- Step 2: Restore legacy IDs
UPDATE user_oauth SET user_oauth_id_int = legacy_user_oauth_id;

-- Step 3: Drop UUID primary key
ALTER TABLE user_oauth DROP CONSTRAINT IF EXISTS user_oauth_pkey CASCADE;

-- Step 4: Rename columns
ALTER TABLE user_oauth RENAME COLUMN user_oauth_id TO user_oauth_uuid;
ALTER TABLE user_oauth RENAME COLUMN user_oauth_id_int TO user_oauth_id;

-- Step 5: Set integer column as NOT NULL and primary key
ALTER TABLE user_oauth ALTER COLUMN user_oauth_id SET NOT NULL;
ALTER TABLE user_oauth ADD PRIMARY KEY (user_oauth_id);

-- Step 6: Restore sequence
CREATE SEQUENCE IF NOT EXISTS user_oauth_user_oauth_id_seq;
SELECT setval('user_oauth_user_oauth_id_seq',
  (SELECT COALESCE(MAX(user_oauth_id), 1) FROM user_oauth));
ALTER TABLE user_oauth
  ALTER COLUMN user_oauth_id
  SET DEFAULT nextval('user_oauth_user_oauth_id_seq');

-- Step 7: Drop legacy ID constraint and index
DROP INDEX IF EXISTS idx_user_oauth_legacy_user_oauth_id;
ALTER TABLE user_oauth DROP CONSTRAINT IF EXISTS user_oauth_legacy_user_oauth_id_unique;

-- Step 8: Remove UUID and legacy columns
ALTER TABLE user_oauth DROP COLUMN legacy_user_oauth_id;
ALTER TABLE user_oauth DROP COLUMN user_oauth_uuid;

-- Step 9: Verify rollback
SELECT COUNT(*) as total_records,
       COUNT(user_oauth_id) as records_with_id
FROM user_oauth;
*/
