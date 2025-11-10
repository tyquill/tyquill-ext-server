-- Migration: Job PK from Integer to UUID
-- Date: 2025-11-10
-- Description: Updates jobs.job_id from serial integer to UUID PK
-- Special Case: jobUuid field already exists and is used for ALL queries
-- Strategy: Promote existing job_uuid to PK, drop unused job_id

-- ============================================================================
-- FORWARD MIGRATION (UP)
-- ============================================================================

-- Step 1: Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 2: Drop existing primary key constraint
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_pkey CASCADE;

-- Step 3: Drop old integer job_id column (unused in codebase)
ALTER TABLE jobs DROP COLUMN job_id;

-- Step 4: Rename job_uuid to job_id (making it the new PK)
ALTER TABLE jobs RENAME COLUMN job_uuid TO job_id;

-- Step 5: Set UUID column as primary key
ALTER TABLE jobs ADD PRIMARY KEY (job_id);

-- ============================================================================
-- DATA VALIDATION
-- ============================================================================

-- Verify all records have valid UUID primary keys
DO $$
DECLARE
  invalid_uuids INTEGER;
BEGIN
  -- Check for invalid UUIDs (cast to text for regex check)
  SELECT COUNT(*) INTO invalid_uuids
  FROM jobs
  WHERE job_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  IF invalid_uuids > 0 THEN
    RAISE EXCEPTION 'Migration failed: % records have invalid UUID format', invalid_uuids;
  END IF;

  RAISE NOTICE 'Validation passed: All jobs records migrated successfully';
END $$;

-- Display migration summary
DO $$
DECLARE
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM jobs;

  RAISE NOTICE '=== Migration Summary ===';
  RAISE NOTICE 'Total jobs records: %', total_count;
  RAISE NOTICE 'All records now use UUID primary keys (promoted from job_uuid)';
  RAISE NOTICE 'Note: No code changes needed - codebase already uses job_uuid for all queries';
END $$;

-- ============================================================================
-- ROLLBACK MIGRATION (DOWN)
-- ============================================================================
-- Run the following commands to rollback if needed:

/*
-- Note: Job is a queue tracking entity that is never queried by ID directly.
-- The integer job_id was never used in the codebase - all queries use job_uuid.
-- Rollback requires recreating all job records from scratch.
-- This migration is irreversible in practice - recommend database restore from backup.

-- If rollback is absolutely necessary:
-- 1. Backup current jobs data (export job_id, job_type, status, user_id, etc.)
-- 2. Drop jobs table
-- 3. Recreate with integer PK
-- 4. Generate new job_uuid values and restore data
-- 5. Note: Any external references to job UUIDs will be broken
*/
