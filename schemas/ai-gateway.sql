-- AI Gateway / Proxy Schema
-- Route, rate-limit, cache, and monitor LLM API calls

CREATE TABLE providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    base_url TEXT NOT NULL,
    auth_type VARCHAR(20) NOT NULL DEFAULT 'bearer',
    is_active BOOLEAN NOT NULL DEFAULT true,
    default_timeout_ms INTEGER NOT NULL DEFAULT 30000,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES providers(id),
    model_id VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    input_cost_per_million NUMERIC(10,4),
    output_cost_per_million NUMERIC(10,4),
    max_context_tokens INTEGER,
    supports_streaming BOOLEAN NOT NULL DEFAULT true,
    supports_tools BOOLEAN NOT NULL DEFAULT false,
    supports_vision BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    key_prefix VARCHAR(8) NOT NULL,
    provider_id UUID REFERENCES providers(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    rate_limit_rpm INTEGER,
    rate_limit_tpm INTEGER,
    monthly_budget_cents INTEGER,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE routing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    match_model_pattern VARCHAR(255),
    match_metadata JSONB,
    target_provider_id UUID NOT NULL REFERENCES providers(id),
    target_model_id UUID REFERENCES models(id),
    weight INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fallback_chains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    primary_model_id UUID NOT NULL REFERENCES models(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fallback_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_id UUID NOT NULL REFERENCES fallback_chains(id),
    model_id UUID NOT NULL REFERENCES models(id),
    step_order INTEGER NOT NULL,
    timeout_ms INTEGER NOT NULL DEFAULT 10000,
    retry_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES api_keys(id),
    model_id UUID REFERENCES models(id),
    window_seconds INTEGER NOT NULL DEFAULT 60,
    max_requests INTEGER NOT NULL,
    max_tokens INTEGER,
    current_count INTEGER NOT NULL DEFAULT 0,
    window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cache_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key VARCHAR(64) NOT NULL UNIQUE,
    model_id UUID NOT NULL REFERENCES models(id),
    request_hash VARCHAR(64) NOT NULL,
    response_body JSONB NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    ttl_seconds INTEGER NOT NULL DEFAULT 3600,
    hit_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES api_keys(id),
    model_id UUID REFERENCES models(id),
    provider_id UUID REFERENCES providers(id),
    request_method VARCHAR(10) NOT NULL DEFAULT 'POST',
    request_path TEXT NOT NULL,
    status_code INTEGER,
    input_tokens INTEGER,
    output_tokens INTEGER,
    latency_ms INTEGER,
    cost_cents NUMERIC(10,4),
    cache_hit BOOLEAN NOT NULL DEFAULT false,
    error_type VARCHAR(50),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cost_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES api_keys(id),
    model_id UUID REFERENCES models(id),
    period_start DATE NOT NULL,
    period_type VARCHAR(10) NOT NULL DEFAULT 'daily',
    total_requests INTEGER NOT NULL DEFAULT 0,
    total_input_tokens BIGINT NOT NULL DEFAULT 0,
    total_output_tokens BIGINT NOT NULL DEFAULT 0,
    total_cost_cents NUMERIC(12,4) NOT NULL DEFAULT 0,
    cache_hits INTEGER NOT NULL DEFAULT 0,
    errors INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(api_key_id, model_id, period_start, period_type)
);

-- Indexes
CREATE INDEX idx_models_provider ON models(provider_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX idx_routing_rules_priority ON routing_rules(priority);
CREATE INDEX idx_fallback_steps_chain ON fallback_steps(chain_id, step_order);
CREATE INDEX idx_rate_limits_key ON rate_limits(api_key_id);
CREATE INDEX idx_cache_entries_expires ON cache_entries(expires_at);
CREATE INDEX idx_request_logs_key ON request_logs(api_key_id);
CREATE INDEX idx_request_logs_created ON request_logs(created_at);
CREATE INDEX idx_cost_tracking_period ON cost_tracking(period_start, period_type);
