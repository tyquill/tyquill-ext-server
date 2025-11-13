-- ========================================
-- Repurpose Feature - Tables Creation
-- ========================================

-- 1. Format Rules Table (플랫폼별 규칙)
CREATE TABLE format_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    format TEXT CHECK (format IN ('blog', 'twitter', 'linkedin', 'instagram', 'youtube', 'tiktok', 'email', 'podcast', 'custom')) NOT NULL,
    constraints JSONB NOT NULL,
    best_practices JSONB NOT NULL,
    system_prompt TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE format_rules ADD CONSTRAINT format_rules_format_unique UNIQUE (format);

-- 2. Format Templates Table (사용자 정의 템플릿)
CREATE TABLE format_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    format TEXT CHECK (format IN ('blog', 'twitter', 'linkedin', 'instagram', 'youtube', 'tiktok', 'email', 'podcast', 'custom')) NOT NULL,
    prompt_template TEXT NOT NULL,
    rules JSONB NOT NULL,
    variables JSONB,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    usage_count INTEGER NOT NULL DEFAULT 0,
    rating REAL NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE format_templates
    ADD CONSTRAINT format_templates_creator_id_foreign
    FOREIGN KEY (creator_id) REFERENCES users(user_id)
    ON UPDATE CASCADE;

-- 3. Repurposing Jobs Table (비동기 작업 추적)
CREATE TABLE repurposing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    article_id UUID,
    article_ids TEXT,
    formats TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) NOT NULL DEFAULT 'pending',
    progress INTEGER NOT NULL DEFAULT 0,
    format_progress JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE repurposing_jobs
    ADD CONSTRAINT repurposing_jobs_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON UPDATE CASCADE;

ALTER TABLE repurposing_jobs
    ADD CONSTRAINT repurposing_jobs_article_id_foreign
    FOREIGN KEY (article_id) REFERENCES articles(article_id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;

-- 4. Repurposed Contents Table (생성된 콘텐츠)
CREATE TABLE repurposed_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL,
    user_id UUID NOT NULL,
    format TEXT CHECK (format IN ('blog', 'twitter', 'linkedin', 'instagram', 'youtube', 'tiktok', 'email', 'podcast', 'custom')) NOT NULL,
    content TEXT NOT NULL,
    format_specific_data JSONB,
    quality_score INTEGER NOT NULL DEFAULT 0,
    quality_details JSONB,
    character_count INTEGER NOT NULL DEFAULT 0,
    word_count INTEGER NOT NULL DEFAULT 0,
    is_edited BOOLEAN NOT NULL DEFAULT FALSE,
    template_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_partition DATE NOT NULL
);

CREATE INDEX repurposed_contents_date_partition_index ON repurposed_contents(date_partition);
CREATE INDEX repurposed_contents_article_id_index ON repurposed_contents(article_id);
CREATE INDEX repurposed_contents_user_id_index ON repurposed_contents(user_id);
CREATE INDEX repurposed_contents_format_index ON repurposed_contents(format);

ALTER TABLE repurposed_contents
    ADD CONSTRAINT repurposed_contents_article_id_foreign
    FOREIGN KEY (article_id) REFERENCES articles(article_id)
    ON UPDATE CASCADE;

ALTER TABLE repurposed_contents
    ADD CONSTRAINT repurposed_contents_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON UPDATE CASCADE;

ALTER TABLE repurposed_contents
    ADD CONSTRAINT repurposed_contents_template_id_foreign
    FOREIGN KEY (template_id) REFERENCES format_templates(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;

-- 5. Export Histories Table (익스포트 이력)
CREATE TABLE export_histories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    repurposed_content_id UUID,
    repurposed_content_ids TEXT,
    destination TEXT CHECK (destination IN ('clipboard', 'zip', 'notion', 'google_docs', 'buffer', 'hootsuite', 'zapier')) NOT NULL,
    metadata JSONB,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    exported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_partition DATE NOT NULL
);

CREATE INDEX export_histories_date_partition_index ON export_histories(date_partition);
CREATE INDEX export_histories_user_id_index ON export_histories(user_id);
CREATE INDEX export_histories_destination_index ON export_histories(destination);

ALTER TABLE export_histories
    ADD CONSTRAINT export_histories_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON UPDATE CASCADE;

ALTER TABLE export_histories
    ADD CONSTRAINT export_histories_repurposed_content_id_foreign
    FOREIGN KEY (repurposed_content_id) REFERENCES repurposed_contents(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;

-- Comments for documentation
COMMENT ON TABLE format_rules IS '플랫폼별 규칙과 제약사항을 저장하는 테이블';
COMMENT ON TABLE format_templates IS '사용자 정의 포맷 템플릿을 저장하는 테이블';
COMMENT ON TABLE repurposing_jobs IS '멀티포맷 리퍼포징 비동기 작업을 추적하는 테이블';
COMMENT ON TABLE repurposed_contents IS '리퍼포징된 콘텐츠를 저장하는 테이블';
COMMENT ON TABLE export_histories IS '외부 플랫폼으로의 익스포트 이력을 저장하는 테이블';
