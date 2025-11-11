-- Migration: Add Account Deletion Audit Table
-- Date: 2025-11-11
-- Description: Creates audit table for tracking account deletions
--              Records who deleted which account, when, and the results

-- UP Migration

-- Create account_deletion_audit table
CREATE TABLE account_deletion_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    deleted_by VARCHAR(20) NOT NULL CHECK (deleted_by IN ('self', 'admin')),
    admin_id UUID,
    deleted_entity_counts JSONB NOT NULL,
    s3_files_deleted INTEGER DEFAULT 0,
    errors JSONB,
    deleted_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add comment for table documentation
COMMENT ON TABLE account_deletion_audit IS 'Audit log for account deletion operations';
COMMENT ON COLUMN account_deletion_audit.user_id IS 'UUID of the deleted user';
COMMENT ON COLUMN account_deletion_audit.user_email IS 'Email of the deleted user';
COMMENT ON COLUMN account_deletion_audit.deleted_by IS 'Who initiated deletion: self or admin';
COMMENT ON COLUMN account_deletion_audit.admin_id IS 'UUID of admin who deleted (null if self-deletion)';
COMMENT ON COLUMN account_deletion_audit.deleted_entity_counts IS 'JSON object with counts of deleted entities';
COMMENT ON COLUMN account_deletion_audit.s3_files_deleted IS 'Number of S3 files deleted';
COMMENT ON COLUMN account_deletion_audit.errors IS 'Array of error messages if any occurred';
COMMENT ON COLUMN account_deletion_audit.deleted_at IS 'Timestamp of deletion';

-- Create indexes for common queries
CREATE INDEX idx_account_deletion_audit_user_id ON account_deletion_audit(user_id);
CREATE INDEX idx_account_deletion_audit_deleted_at ON account_deletion_audit(deleted_at);
CREATE INDEX idx_account_deletion_audit_deleted_by ON account_deletion_audit(deleted_by);
CREATE INDEX idx_account_deletion_audit_admin_id ON account_deletion_audit(admin_id) WHERE admin_id IS NOT NULL;

-- DOWN Migration (Rollback)

-- Drop indexes
DROP INDEX IF EXISTS idx_account_deletion_audit_admin_id;
DROP INDEX IF EXISTS idx_account_deletion_audit_deleted_by;
DROP INDEX IF EXISTS idx_account_deletion_audit_deleted_at;
DROP INDEX IF EXISTS idx_account_deletion_audit_user_id;

-- Drop table
DROP TABLE IF EXISTS account_deletion_audit;
