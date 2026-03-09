# ChartDB on Cloudflare Workers

A fork of [ChartDB](https://github.com/chartdb/chartdb) deployed on Cloudflare Workers with a secure Workers AI proxy. Live at **[db.getboring.io](https://db.getboring.io)**.

## What's Different

This fork adds:

- **Cloudflare Workers deployment** — Static assets + API on a single Worker
- **Workers AI proxy** — AI-powered SQL export using `@cf/openai/gpt-oss-120b` (128K context), no API keys exposed to the browser
- **OpenAI-compatible API** — Worker translates between Vercel AI SDK and Workers AI, with SSE stream filtering for strict compatibility
- **Custom domain routing** — Served from `db.getboring.io` via Cloudflare DNS

## Architecture

```
Browser (Vite SPA)
  |-- Static assets --> Cloudflare Workers Assets (./dist)
  |-- /api/v1/*     --> Worker (worker.ts)
                         |-- Workers AI binding (@cf/openai/gpt-oss-120b)
```

The Worker intercepts `/api/v1/*` requests and proxies them to Workers AI. All other requests are served as static assets with SPA fallback routing.

### Key Files

| File | Purpose |
|------|---------|
| `worker.ts` | Cloudflare Worker — CORS, AI proxy, stream filtering |
| `wrangler.toml` | Deployment config — routes, AI binding, assets |
| `public/config.js` | Runtime browser config — endpoint, model, feature flags |
| `src/lib/data/sql-export/export-sql-script.ts` | AI SQL export logic (uses `@ai-sdk/openai`) |

### Workers AI Stream Filtering

Workers AI includes non-standard SSE events (e.g., `{"response":"","usage":{...}}`) that lack the required `choices` array. The `filterOpenAIStream()` function in `worker.ts` strips these to prevent Zod validation failures in the AI SDK.

### AI SDK Compatibility

`@ai-sdk/openai` v2.x defaults to the Responses API (`/responses`). This fork uses `openai.chat(modelName)` to force the Chat Completions API (`/chat/completions`), which is what the Worker implements.

## Setup

### Prerequisites

- Node.js 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- Cloudflare account with Workers AI enabled

### Local Development

```bash
npm install
npm run dev
```

The Vite dev server runs at `http://localhost:5173`. AI features require the Worker running:

```bash
wrangler dev
```

### Build & Deploy

```bash
npm run build
wrangler deploy
```

### Configuration

**`public/config.js`** — Runtime config loaded before the app:

```javascript
window.env = {
    OPENAI_API_ENDPOINT: '/api/v1',    // Worker proxy path
    LLM_MODEL_NAME: 'gpt-oss-120b',   // Workers AI model
    OPENAI_API_KEY: 'proxy',           // Placeholder (Worker handles auth)
    HIDE_CHARTDB_CLOUD: 'true',        // Hide cloud upsell
    DISABLE_ANALYTICS: 'true',         // No tracking
};
```

**`wrangler.toml`** — Worker deployment:

```toml
name = "chartdb"
compatibility_date = "2026-03-08"
compatibility_flags = ["nodejs_compat"]
main = "./worker.ts"

routes = [
  { pattern = "db.getboring.io/*", zone_name = "getboring.io" }
]

[ai]
binding = "AI"

[assets]
directory = "./dist"
not_found_handling = "single-page-application"
binding = "ASSETS"
run_worker_first = ["/api/v1/*"]
```

## CORS

The Worker allows requests from:

- `https://db.getboring.io`
- `https://chartdb.codyboring.workers.dev`
- `http://localhost:5173`

Edit `ALLOWED_ORIGINS` in `worker.ts` to modify.

## Upstream

Based on [chartdb/chartdb](https://github.com/chartdb/chartdb). See the upstream repo for full ChartDB documentation, features, and contribution guidelines.

## License

Same as upstream — [AGPL-3.0](https://github.com/chartdb/chartdb/blob/main/LICENSE).
