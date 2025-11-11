-- Migration: Add pending_s3_deletions table for compensating S3 cleanup transactions
-- This ensures GDPR compliance by tracking S3 files that need deletion even if cleanup fails

CREATE TABLE pending_s3_deletions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    s3_key VARCHAR(512) NOT NULL,
    bucket_name VARCHAR(255) NOT NULL,
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    next_retry_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pending_s3_deletions_user_id ON pending_s3_deletions(user_id);
CREATE INDEX idx_pending_s3_deletions_status ON pending_s3_deletions(status);
CREATE INDEX idx_pending_s3_deletions_created_at ON pending_s3_deletions(created_at);
CREATE INDEX idx_pending_s3_deletions_next_retry ON pending_s3_deletions(next_retry_at) WHERE status = 'pending';

COMMENT ON TABLE pending_s3_deletions IS 'Tracks S3 files pending deletion for GDPR compliance';
COMMENT ON COLUMN pending_s3_deletions.user_id IS 'User whose account was deleted';
COMMENT ON COLUMN pending_s3_deletions.s3_key IS 'S3 object key to delete';
COMMENT ON COLUMN pending_s3_deletions.retry_count IS 'Number of deletion attempts';
COMMENT ON COLUMN pending_s3_deletions.next_retry_at IS 'When to retry deletion (exponential backoff)';
