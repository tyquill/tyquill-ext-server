-- Migration: Add language column to users table
-- Date: 2025-11-11
-- Description: Adds language preference field to users table with default 'en'

-- ============================================================================
-- FORWARD MIGRATION (UP)
-- ============================================================================

-- Add language column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';

-- Set default value for existing users
UPDATE users SET language = 'en' WHERE language IS NULL;

-- ============================================================================
-- DATA VALIDATION
-- ============================================================================

DO $$
DECLARE
  total_users INTEGER;
  users_with_language INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_users FROM users;
  SELECT COUNT(*) INTO users_with_language FROM users WHERE language IS NOT NULL;

  IF total_users != users_with_language THEN
    RAISE EXCEPTION 'Migration validation failed: % users missing language', (total_users - users_with_language);
  END IF;

  RAISE NOTICE 'Validation passed: All % users have language set', total_users;
END $$;

-- ============================================================================
-- ROLLBACK MIGRATION (DOWN)
-- ============================================================================
-- Run the following command to rollback if needed:

/*
ALTER TABLE users DROP COLUMN IF EXISTS language;
*/
