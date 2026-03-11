-- Multi-Agent Orchestration Schema
-- Agent configs, conversations, tool calls, handoffs, and execution traces

CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    system_prompt TEXT NOT NULL,
    model VARCHAR(100) NOT NULL,
    temperature NUMERIC(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 4096,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    version INTEGER NOT NULL,
    config JSONB NOT NULL,
    allowed_tools JSONB DEFAULT '[]',
    allowed_handoff_targets JSONB DEFAULT '[]',
    max_turns INTEGER DEFAULT 25,
    timeout_ms INTEGER DEFAULT 120000,
    is_active BOOLEAN NOT NULL DEFAULT false,
    activated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(agent_id, version)
);

CREATE TABLE tool_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    input_schema JSONB NOT NULL,
    output_schema JSONB,
    handler_type VARCHAR(50) NOT NULL DEFAULT 'function',
    handler_config JSONB DEFAULT '{}',
    requires_confirmation BOOLEAN NOT NULL DEFAULT false,
    timeout_ms INTEGER DEFAULT 30000,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    initial_agent_id UUID NOT NULL REFERENCES agents(id),
    current_agent_id UUID NOT NULL REFERENCES agents(id),
    user_id VARCHAR(255),
    title VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    total_turns INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    total_cost_cents NUMERIC(10,4) DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE turns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    agent_id UUID NOT NULL REFERENCES agents(id),
    turn_number INTEGER NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    latency_ms INTEGER,
    model_used VARCHAR(100),
    finish_reason VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tool_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    turn_id UUID NOT NULL REFERENCES turns(id),
    tool_id UUID NOT NULL REFERENCES tool_registry(id),
    call_id VARCHAR(255) NOT NULL,
    input_args JSONB NOT NULL,
    output_result JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    latency_ms INTEGER,
    confirmed_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE handoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    from_agent_id UUID NOT NULL REFERENCES agents(id),
    to_agent_id UUID NOT NULL REFERENCES agents(id),
    from_turn_id UUID NOT NULL REFERENCES turns(id),
    reason TEXT,
    context_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE execution_traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    turn_id UUID REFERENCES turns(id),
    trace_type VARCHAR(50) NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    event_data JSONB DEFAULT '{}',
    parent_trace_id UUID REFERENCES execution_traces(id),
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    conversation_id UUID REFERENCES conversations(id),
    memory_type VARCHAR(50) NOT NULL DEFAULT 'episodic',
    key VARCHAR(255) NOT NULL,
    value JSONB NOT NULL,
    importance_score NUMERIC(5,4) DEFAULT 0.5,
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_agent_configs_agent ON agent_configs(agent_id);
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_turns_conversation ON turns(conversation_id, turn_number);
CREATE INDEX idx_turns_agent ON turns(agent_id);
CREATE INDEX idx_tool_calls_turn ON tool_calls(turn_id);
CREATE INDEX idx_tool_calls_tool ON tool_calls(tool_id);
CREATE INDEX idx_handoffs_conversation ON handoffs(conversation_id);
CREATE INDEX idx_execution_traces_conversation ON execution_traces(conversation_id);
CREATE INDEX idx_execution_traces_parent ON execution_traces(parent_trace_id);
CREATE INDEX idx_memory_agent ON memory(agent_id);
CREATE INDEX idx_memory_conversation ON memory(conversation_id);
CREATE INDEX idx_memory_key ON memory(agent_id, key);
