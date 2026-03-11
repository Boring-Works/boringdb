-- RAG Pipeline Schema
-- Vector search, document processing, and retrieval-augmented generation

CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    embedding_model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-3-small',
    embedding_dimensions INTEGER NOT NULL DEFAULT 1536,
    chunk_strategy VARCHAR(50) NOT NULL DEFAULT 'recursive',
    chunk_size INTEGER NOT NULL DEFAULT 512,
    chunk_overlap INTEGER NOT NULL DEFAULT 50,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES collections(id),
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    uri TEXT,
    mime_type VARCHAR(100),
    file_size_bytes BIGINT,
    checksum VARCHAR(64),
    metadata JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES sources(id),
    collection_id UUID NOT NULL REFERENCES collections(id),
    title VARCHAR(500),
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    page_number INTEGER,
    metadata JSONB DEFAULT '{}',
    token_count INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id),
    collection_id UUID NOT NULL REFERENCES collections(id),
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    token_count INTEGER NOT NULL,
    start_offset INTEGER,
    end_offset INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id UUID NOT NULL REFERENCES chunks(id),
    collection_id UUID NOT NULL REFERENCES collections(id),
    model VARCHAR(100) NOT NULL,
    dimensions INTEGER NOT NULL,
    vector_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vector_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES collections(id),
    provider VARCHAR(50) NOT NULL,
    index_name VARCHAR(255) NOT NULL,
    config JSONB DEFAULT '{}',
    document_count INTEGER NOT NULL DEFAULT 0,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE retrieval_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES collections(id),
    query_text TEXT NOT NULL,
    query_embedding JSONB,
    top_k INTEGER NOT NULL DEFAULT 5,
    similarity_threshold NUMERIC(5,4) DEFAULT 0.7,
    filter_metadata JSONB,
    rerank_model VARCHAR(100),
    latency_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE retrieval_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID NOT NULL REFERENCES retrieval_queries(id),
    chunk_id UUID NOT NULL REFERENCES chunks(id),
    similarity_score NUMERIC(7,6) NOT NULL,
    rerank_score NUMERIC(7,6),
    rank_position INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID NOT NULL REFERENCES retrieval_queries(id),
    result_id UUID REFERENCES retrieval_results(id),
    rating INTEGER NOT NULL,
    comment TEXT,
    user_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_sources_collection ON sources(collection_id);
CREATE INDEX idx_sources_status ON sources(status);
CREATE INDEX idx_documents_source ON documents(source_id);
CREATE INDEX idx_documents_collection ON documents(collection_id);
CREATE INDEX idx_chunks_document ON chunks(document_id);
CREATE INDEX idx_chunks_collection ON chunks(collection_id);
CREATE INDEX idx_embeddings_chunk ON embeddings(chunk_id);
CREATE INDEX idx_embeddings_collection ON embeddings(collection_id);
CREATE INDEX idx_retrieval_queries_collection ON retrieval_queries(collection_id);
CREATE INDEX idx_retrieval_results_query ON retrieval_results(query_id);
CREATE INDEX idx_feedback_query ON feedback(query_id);
