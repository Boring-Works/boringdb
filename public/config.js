window.env = {
    OPENAI_API_ENDPOINT: '/api/v1',
    LLM_MODEL_NAME: 'nemotron-3-120b',
    // NVIDIA Nemotron 3 (120B/12B active) for AI diagram generation — outputs
    // native DBML cleanly. Must match wrangler.toml AI_DIAGRAM_MODEL.
    AI_DIAGRAM_MODEL: 'nemotron-3-120b',
    OPENAI_API_KEY: 'proxy',
    HIDE_CHARTDB_CLOUD: 'true',
    DISABLE_ANALYTICS: 'true',
};
