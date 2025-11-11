-- Migration: Add CASCADE constraints to all foreign keys referencing users
-- This ensures database-level cascade deletion and prevents orphaned records

-- 1. Drop existing foreign key constraints and re-create with CASCADE

-- scraps table
ALTER TABLE scraps
DROP CONSTRAINT IF EXISTS scraps_user_id_foreign;

ALTER TABLE scraps
ADD CONSTRAINT scraps_user_id_foreign
FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- articles table
ALTER TABLE articles
DROP CONSTRAINT IF EXISTS articles_user_id_foreign;

ALTER TABLE articles
ADD CONSTRAINT articles_user_id_foreign
FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- tags table
ALTER TABLE tags
DROP CONSTRAINT IF EXISTS tags_user_id_foreign;

ALTER TABLE tags
ADD CONSTRAINT tags_user_id_foreign
FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- writing_styles table
ALTER TABLE writing_styles
DROP CONSTRAINT IF EXISTS writing_styles_user_id_foreign;

ALTER TABLE writing_styles
ADD CONSTRAINT writing_styles_user_id_foreign
FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- folders table
ALTER TABLE folders
DROP CONSTRAINT IF EXISTS folders_user_id_foreign;

ALTER TABLE folders
ADD CONSTRAINT folders_user_id_foreign
FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- jobs table (assuming job_status or jobs table)
ALTER TABLE jobs
DROP CONSTRAINT IF EXISTS jobs_user_id_foreign;

ALTER TABLE jobs
ADD CONSTRAINT jobs_user_id_foreign
FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- user_oauth table
ALTER TABLE user_oauth
DROP CONSTRAINT IF EXISTS user_oauth_user_id_foreign;

ALTER TABLE user_oauth
ADD CONSTRAINT user_oauth_user_id_foreign
FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- 2. Add CASCADE to article-related tables (cascade through articles)

-- article_scraps table
ALTER TABLE article_scraps
DROP CONSTRAINT IF EXISTS article_scraps_article_id_foreign;

ALTER TABLE article_scraps
ADD CONSTRAINT article_scraps_article_id_foreign
FOREIGN KEY (article_id) REFERENCES articles(article_id) ON DELETE CASCADE;

-- article_archives table
ALTER TABLE article_archives
DROP CONSTRAINT IF EXISTS article_archives_article_id_foreign;

ALTER TABLE article_archives
ADD CONSTRAINT article_archives_article_id_foreign
FOREIGN KEY (article_id) REFERENCES articles(article_id) ON DELETE CASCADE;

-- 3. Add CASCADE to writing_style_examples (cascade through writing_styles)

-- writing_style_examples table
ALTER TABLE writing_style_examples
DROP CONSTRAINT IF EXISTS writing_style_examples_writing_style_id_foreign;

ALTER TABLE writing_style_examples
ADD CONSTRAINT writing_style_examples_writing_style_id_foreign
FOREIGN KEY (writing_style_id) REFERENCES writing_styles(writing_style_id) ON DELETE CASCADE;

-- 4. Add CASCADE to folders parent_id self-reference

ALTER TABLE folders
DROP CONSTRAINT IF EXISTS folders_parent_id_foreign;

ALTER TABLE folders
ADD CONSTRAINT folders_parent_id_foreign
FOREIGN KEY (parent_id) REFERENCES folders(folder_id) ON DELETE CASCADE;

-- Verification query to check all CASCADE constraints are in place
-- Run this after migration to verify:
-- SELECT
--     tc.constraint_name,
--     tc.table_name,
--     kcu.column_name,
--     ccu.table_name AS foreign_table_name,
--     ccu.column_name AS foreign_column_name,
--     rc.delete_rule
-- FROM
--     information_schema.table_constraints AS tc
--     JOIN information_schema.key_column_usage AS kcu
--       ON tc.constraint_name = kcu.constraint_name
--       AND tc.table_schema = kcu.table_schema
--     JOIN information_schema.constraint_column_usage AS ccu
--       ON ccu.constraint_name = tc.constraint_name
--       AND ccu.table_schema = tc.table_schema
--     JOIN information_schema.referential_constraints AS rc
--       ON tc.constraint_name = rc.constraint_name
--       AND tc.table_schema = rc.constraint_schema
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--     AND ccu.table_name IN ('users', 'articles', 'writing_styles', 'folders')
--     AND tc.table_schema = 'public'
-- ORDER BY tc.table_name;
