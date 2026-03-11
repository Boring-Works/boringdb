-- Prompt Management Schema
-- Version, test, evaluate, and deploy prompts

CREATE TABLE prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    system_prompt TEXT,
    category VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prompt_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID NOT NULL REFERENCES prompts(id),
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    model VARCHAR(100),
    temperature NUMERIC(3,2),
    max_tokens INTEGER,
    stop_sequences JSONB,
    change_notes TEXT,
    is_published BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMPTZ,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(prompt_id, version)
);

CREATE TABLE variables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID NOT NULL REFERENCES prompts(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    var_type VARCHAR(20) NOT NULL DEFAULT 'string',
    default_value TEXT,
    required BOOLEAN NOT NULL DEFAULT true,
    validation_regex VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(prompt_id, name)
);

CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prompt_tags (
    prompt_id UUID NOT NULL REFERENCES prompts(id),
    tag_id UUID NOT NULL REFERENCES tags(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (prompt_id, tag_id)
);

CREATE TABLE test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID NOT NULL REFERENCES prompts(id),
    name VARCHAR(255) NOT NULL,
    input_variables JSONB NOT NULL,
    expected_output TEXT,
    expected_contains JSONB,
    expected_not_contains JSONB,
    max_latency_ms INTEGER,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_version_id UUID NOT NULL REFERENCES prompt_versions(id),
    name VARCHAR(255),
    model VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    total_cases INTEGER NOT NULL DEFAULT 0,
    passed_cases INTEGER NOT NULL DEFAULT 0,
    failed_cases INTEGER NOT NULL DEFAULT 0,
    avg_latency_ms INTEGER,
    avg_cost_cents NUMERIC(10,4),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE eval_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID NOT NULL REFERENCES evaluations(id),
    test_case_id UUID NOT NULL REFERENCES test_cases(id),
    actual_output TEXT NOT NULL,
    passed BOOLEAN NOT NULL,
    latency_ms INTEGER NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_cents NUMERIC(10,4),
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_version_id UUID NOT NULL REFERENCES prompt_versions(id),
    environment VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    deployed_by VARCHAR(255),
    rollback_version_id UUID REFERENCES prompt_versions(id),
    deployed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_prompt_versions_prompt ON prompt_versions(prompt_id);
CREATE INDEX idx_prompt_versions_published ON prompt_versions(prompt_id, is_published);
CREATE INDEX idx_variables_prompt ON variables(prompt_id);
CREATE INDEX idx_test_cases_prompt ON test_cases(prompt_id);
CREATE INDEX idx_evaluations_version ON evaluations(prompt_version_id);
CREATE INDEX idx_evaluations_status ON evaluations(status);
CREATE INDEX idx_eval_results_evaluation ON eval_results(evaluation_id);
CREATE INDEX idx_eval_results_test_case ON eval_results(test_case_id);
CREATE INDEX idx_deployments_version ON deployments(prompt_version_id);
CREATE INDEX idx_deployments_env ON deployments(environment, is_active);
