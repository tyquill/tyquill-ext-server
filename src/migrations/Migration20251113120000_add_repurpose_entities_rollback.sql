-- ========================================
-- Repurpose Feature - Tables Rollback
-- ========================================

-- Drop tables in reverse order (respecting foreign key dependencies)

DROP TABLE IF EXISTS export_histories CASCADE;
DROP TABLE IF EXISTS repurposed_contents CASCADE;
DROP TABLE IF EXISTS repurposing_jobs CASCADE;
DROP TABLE IF EXISTS format_templates CASCADE;
DROP TABLE IF EXISTS format_rules CASCADE;
