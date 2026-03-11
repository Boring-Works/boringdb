-- Evals Platform Schema
-- LLM evaluation with test suites, model runs, and Elo ratings

CREATE TABLE datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    format VARCHAR(50) NOT NULL DEFAULT 'jsonl',
    record_count INTEGER NOT NULL DEFAULT 0,
    schema_definition JSONB,
    source_url TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE test_suites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    dataset_id UUID REFERENCES datasets(id),
    eval_type VARCHAR(50) NOT NULL DEFAULT 'accuracy',
    scoring_rubric JSONB,
    pass_threshold NUMERIC(5,4) DEFAULT 0.8,
    judge_model VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suite_id UUID NOT NULL REFERENCES test_suites(id),
    input_text TEXT NOT NULL,
    expected_output TEXT,
    reference_context TEXT,
    category VARCHAR(100),
    difficulty VARCHAR(20) DEFAULT 'medium',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE model_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suite_id UUID NOT NULL REFERENCES test_suites(id),
    model_name VARCHAR(255) NOT NULL,
    model_provider VARCHAR(100) NOT NULL,
    model_config JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    total_cases INTEGER NOT NULL DEFAULT 0,
    completed_cases INTEGER NOT NULL DEFAULT 0,
    avg_score NUMERIC(7,4),
    avg_latency_ms INTEGER,
    total_cost_cents NUMERIC(12,4) DEFAULT 0,
    total_input_tokens BIGINT DEFAULT 0,
    total_output_tokens BIGINT DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE judgments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES model_runs(id),
    test_case_id UUID NOT NULL REFERENCES test_cases(id),
    model_output TEXT NOT NULL,
    score NUMERIC(5,4) NOT NULL,
    passed BOOLEAN NOT NULL,
    judge_reasoning TEXT,
    latency_ms INTEGER NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_cents NUMERIC(10,4),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE human_annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    judgment_id UUID NOT NULL REFERENCES judgments(id),
    annotator_id VARCHAR(255) NOT NULL,
    score NUMERIC(5,4) NOT NULL,
    reasoning TEXT,
    agreed_with_judge BOOLEAN,
    annotation_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE comparison_pairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_case_id UUID NOT NULL REFERENCES test_cases(id),
    model_a_run_id UUID NOT NULL REFERENCES model_runs(id),
    model_b_run_id UUID NOT NULL REFERENCES model_runs(id),
    model_a_output TEXT NOT NULL,
    model_b_output TEXT NOT NULL,
    winner VARCHAR(10),
    judge_model VARCHAR(100),
    judge_reasoning TEXT,
    annotator_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE elo_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suite_id UUID NOT NULL REFERENCES test_suites(id),
    model_name VARCHAR(255) NOT NULL,
    model_provider VARCHAR(100) NOT NULL,
    rating NUMERIC(8,2) NOT NULL DEFAULT 1500,
    games_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    confidence_interval NUMERIC(6,2),
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(suite_id, model_name, model_provider)
);

-- Indexes
CREATE INDEX idx_test_cases_suite ON test_cases(suite_id);
CREATE INDEX idx_test_cases_category ON test_cases(category);
CREATE INDEX idx_model_runs_suite ON model_runs(suite_id);
CREATE INDEX idx_model_runs_status ON model_runs(status);
CREATE INDEX idx_judgments_run ON judgments(run_id);
CREATE INDEX idx_judgments_test_case ON judgments(test_case_id);
CREATE INDEX idx_human_annotations_judgment ON human_annotations(judgment_id);
CREATE INDEX idx_comparison_pairs_test_case ON comparison_pairs(test_case_id);
CREATE INDEX idx_elo_ratings_suite ON elo_ratings(suite_id);
CREATE INDEX idx_elo_ratings_rating ON elo_ratings(rating DESC);
