-- MCP Server Registry Schema
-- Discover, connect, and monitor Model Context Protocol servers

CREATE TABLE servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    author VARCHAR(255),
    repository_url TEXT,
    homepage_url TEXT,
    icon_url TEXT,
    transport_type VARCHAR(20) NOT NULL DEFAULT 'stdio',
    is_verified BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    install_count INTEGER NOT NULL DEFAULT 0,
    star_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE server_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID NOT NULL REFERENCES servers(id),
    version VARCHAR(50) NOT NULL,
    mcp_protocol_version VARCHAR(20) NOT NULL,
    changelog TEXT,
    package_url TEXT,
    checksum VARCHAR(64),
    is_latest BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(server_id, version)
);

CREATE TABLE tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID NOT NULL REFERENCES servers(id),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    input_schema JSONB NOT NULL,
    output_schema JSONB,
    is_destructive BOOLEAN NOT NULL DEFAULT false,
    requires_confirmation BOOLEAN NOT NULL DEFAULT false,
    example_input JSONB,
    example_output JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(server_id, name)
);

CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID NOT NULL REFERENCES servers(id),
    uri_template TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    mime_type VARCHAR(100),
    is_dynamic BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(server_id, uri_template)
);

CREATE TABLE prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID NOT NULL REFERENCES servers(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    arguments JSONB DEFAULT '[]',
    example_output TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(server_id, name)
);

CREATE TABLE connection_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID NOT NULL REFERENCES servers(id),
    user_id VARCHAR(255) NOT NULL,
    config_name VARCHAR(255) NOT NULL DEFAULT 'default',
    transport_config JSONB NOT NULL,
    env_vars JSONB DEFAULT '{}',
    auto_connect BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_config_id UUID NOT NULL REFERENCES connection_configs(id),
    tool_name VARCHAR(255),
    resource_uri_pattern TEXT,
    permission_type VARCHAR(20) NOT NULL DEFAULT 'allow',
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_config_id UUID NOT NULL REFERENCES connection_configs(id),
    server_id UUID NOT NULL REFERENCES servers(id),
    request_type VARCHAR(20) NOT NULL,
    tool_name VARCHAR(255),
    resource_uri TEXT,
    prompt_name VARCHAR(255),
    status VARCHAR(20) NOT NULL,
    latency_ms INTEGER,
    error_message TEXT,
    request_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE health_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID NOT NULL REFERENCES servers(id),
    status VARCHAR(20) NOT NULL,
    response_time_ms INTEGER,
    tool_count INTEGER,
    resource_count INTEGER,
    prompt_count INTEGER,
    protocol_version VARCHAR(20),
    error_message TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_server_versions_server ON server_versions(server_id);
CREATE INDEX idx_server_versions_latest ON server_versions(server_id, is_latest);
CREATE INDEX idx_tools_server ON tools(server_id);
CREATE INDEX idx_resources_server ON resources(server_id);
CREATE INDEX idx_prompts_server ON prompts(server_id);
CREATE INDEX idx_connection_configs_server ON connection_configs(server_id);
CREATE INDEX idx_connection_configs_user ON connection_configs(user_id);
CREATE INDEX idx_permissions_config ON permissions(connection_config_id);
CREATE INDEX idx_usage_logs_config ON usage_logs(connection_config_id);
CREATE INDEX idx_usage_logs_server ON usage_logs(server_id);
CREATE INDEX idx_usage_logs_created ON usage_logs(created_at);
CREATE INDEX idx_health_checks_server ON health_checks(server_id);
CREATE INDEX idx_health_checks_checked ON health_checks(checked_at);
CREATE INDEX idx_servers_slug ON servers(slug);
