# ChartDB on Cloudflare Workers

A fork of [ChartDB](https://github.com/chartdb/chartdb) deployed on Cloudflare Workers with AI-powered diagram generation. Live at **[db.getboring.io](https://db.getboring.io)**.

## What's Different

This fork adds:

- **AI Diagram Generator** — Describe a database in plain English, get a visual ERD. Streams DBML in real-time via Monaco editor, then imports through ChartDB's existing 1085-line DBML pipeline to create a full interactive diagram
- **Robust DBML Syntax Fixer** — `fixDBMLSyntax()` post-processor that handles 15+ categories of LLM output variations, ensuring reliable parsing regardless of model output format
- **CompilerError diagnostics** — Proper error extraction from `@dbml/core`'s non-standard `CompilerError` (not an Error instance, uses `.diags` array)
- **Cloudflare Workers deployment** — Static assets + API on a single Worker at `db.getboring.io`
- **Workers AI proxy** — Dual-model routing with no API keys exposed to the browser
- **Stream normalization** — `normalizeAIStream()` converts between Workers AI's legacy and OpenAI SSE formats for full AI SDK compatibility

## Architecture

```
Browser (Vite SPA)
  |-- Static assets --> Cloudflare Workers Assets (./dist)
  |-- /api/v1/*     --> Worker (worker.ts)
                         |-- normalizeAIStream() converts SSE formats
                         |-- MODEL_MAP routes to:
                         |   gpt-oss-120b          -> @cf/openai/gpt-oss-120b (SQL export)
                         |   qwen2.5-coder-32b     -> @cf/qwen/qwen2.5-coder-32b-instruct (diagrams)
```

The Worker intercepts `/api/v1/*` requests and proxies them to Workers AI. The client sends a model name in the request body; the Worker resolves it via `MODEL_MAP` to the correct Workers AI model path. All other requests are served as static assets with SPA fallback routing.

### AI Diagram Flow

```
User prompt -> streamText() via AI SDK -> Worker -> Workers AI (qwen2.5-coder-32b)
     |                                                          |
     |              <-- SSE stream (normalized to OpenAI) <-----|
     v
Monaco editor (live DBML preview with auto-scroll)
     |
     v (user clicks "Create Diagram")
stripCodeFences() -> fixDBMLSyntax() -> @dbml/core Parser -> importDBMLToDiagram()
     |                                                              |
     v                                                              v
Cleaned DBML text                                    Visual ERD (stored in IndexedDB)
```

### Key Files

| File | Purpose |
|------|---------|
| `worker.ts` | Cloudflare Worker — CORS, dual-model AI proxy, `normalizeAIStream()` |
| `wrangler.toml` | Deployment config — routes, AI binding, model vars |
| `public/config.js` | Runtime browser config — endpoint, models, feature flags |
| `src/lib/data/ai-diagram/generate-diagram-from-prompt.ts` | AI service — system prompt, `fixDBMLSyntax()`, streaming |
| `src/dialogs/create-diagram-dialog/ai-generate-step.tsx` | AI generate UI — prompt input, DBML preview, import handler |
| `src/dialogs/create-diagram-dialog/create-diagram-dialog.tsx` | Parent dialog — `importAiDiagram` callback to DBML pipeline |
| `src/lib/data/import-metadata/import-dbml.ts` | DBML import pipeline (1085 lines) — parses DBML to diagram objects |
| `src/lib/data/sql-export/export-sql-script.ts` | AI SQL export logic (uses `gpt-oss-120b` model) |

### Workers AI Stream Normalization

Workers AI has two streaming formats depending on the model:

- **OpenAI-compat models** (`@cf/openai/*`): `{"choices":[{"delta":{"content":"..."}}]}`
- **Legacy models** (`@cf/qwen/*`): `{"response":"..."}` or `{"response":"","usage":{...}}`

The `normalizeAIStream()` function in `worker.ts` converts legacy format events to OpenAI format and drops usage-only events, ensuring the Vercel AI SDK receives a valid stream.

### DBML Syntax Fixer

LLMs produce DBML with various syntax issues. `fixDBMLSyntax()` handles all of these before parsing:

| Issue | Example | Fix |
|-------|---------|-----|
| Uppercase keywords | `TABLE users`, `REF:`, `ENUM` | `Table users`, `Ref:`, `Enum` |
| Inline ENUM types | `role ENUM(admin, member)` | `role varchar(50)` |
| Bare SQL constraints | `name VARCHAR(50) UNIQUE NOT NULL` | `name VARCHAR(50) [unique, not null]` |
| Bare SQL DEFAULT | `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP` | `created_at TIMESTAMP [default: \`CURRENT_TIMESTAMP\`]` |
| Default outside brackets | `field timestamp default: \`now()\`` | `field timestamp [default: \`now()\`]` |
| Bare function defaults | `default: now()` | `default: \`now()\`` |
| Bare identifier defaults | `default: subscriber` | `default: 'subscriber'` |
| Empty default annotations | `[default:]` or `[default: ]` | removed |
| Empty type parens | `varchar()`, `numeric()`, `decimal()` | `varchar(255)`, `numeric(10,2)`, `decimal(10,2)` |
| Quoted enum values | `'admin'` inside Enum block | `admin` |
| Bare index lines | `index(user_id)` | `indexes { user_id }` |
| Bare unique constraints | `unique(post_id, user_id)` | `indexes { (post_id, user_id) [unique] }` |
| Bare primary key lines | `primary key (post_id, tag_id)` | `indexes { (post_id, tag_id) [pk] }` |
| Truncated `not` in brackets | `[unique, not]` | `[unique, not null]` |
| Bare `index` inside brackets | `[ref: > users.id, index]` | `[ref: > users.id]` (removed) |
| Inline `check()` constraints | `check(rating >= 1 and rating <= 5)` | removed (not valid DBML) |
| Markdown code fences | `` ```dbml ... ``` `` | stripped before processing |

### CompilerError Handling

`@dbml/core` throws a `CompilerError` that is **not** an `Error` instance — `instanceof Error` returns false. It has no `.message` property. Instead it carries a `.diags` array of diagnostic objects: `{ message: string, location: { start: { line: number } } }`. The import handler in `ai-generate-step.tsx` checks for `.diags` to extract meaningful error messages for the toast notification.

### DBML Parser Format

The import pipeline uses `parser.parse(content, 'dbmlv2')` — **not** `'dbml'`. The `dbmlv2` format has different syntax requirements. All testing validates against `dbmlv2` to match production behavior.

### AI SDK Compatibility

`@ai-sdk/openai` v2.x defaults to the Responses API (`/responses`). This fork uses `openai.chat(modelName)` to force the Chat Completions API (`/chat/completions`), which is what the Worker implements.

### System Prompt Design

The `buildSystemPrompt()` function generates database-type-aware prompts with:

- Explicit DBML syntax rules with correct examples
- Database-specific type hints (PostgreSQL, MySQL, SQLite, SQL Server, MariaDB, CockroachDB)
- Schema best practices (primary keys, foreign keys with inline refs, indexes, enums, timestamps)
- A complete DBML example showing correct backtick defaults, enum blocks, and index syntax

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
    OPENAI_API_ENDPOINT: '/api/v1',                     // Worker proxy path
    LLM_MODEL_NAME: 'gpt-oss-120b',                     // Workers AI model for SQL export
    AI_DIAGRAM_MODEL: 'qwen2.5-coder-32b-instruct',     // Workers AI model for diagram generation
    OPENAI_API_KEY: 'proxy',                             // Placeholder (Worker handles auth)
    HIDE_CHARTDB_CLOUD: 'true',                          // Hide cloud upsell
    DISABLE_ANALYTICS: 'true',                           // No tracking
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

[vars]
AI_MODEL = "gpt-oss-120b"
AI_DIAGRAM_MODEL = "qwen2.5-coder-32b-instruct"

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

## Storage

All diagram data is stored in the browser's IndexedDB via Dexie.js. No server-side database. The AI generates DBML text which is parsed and rendered entirely client-side.

## Commit History

| Commit | Description |
|--------|-------------|
| `a79de8a` | Initial Cloudflare Workers deployment with Workers AI proxy |
| `3f62d3a` | Force Chat Completions API via `openai.chat()` |
| `434d295` | Add Cloudflare Workers deployment README |
| `f39a108` | Add AI diagram generator feature (prompt to ERD) |
| `afda890` | Update README with AI diagram generator docs |
| `f6baff9` | Fix missing `await` on `streamText()` |
| `ef4e9cc` | Normalize Workers AI stream to OpenAI format for all models |
| `82ec1fb` | Enlarge DBML preview and strip code fences before import |
| `98287b0` | Improve AI DBML quality with better prompt and syntax fixing |
| `3246670` | Add Create Diagram error handling + visible DBML editor scrolling |
| `e362d30` | Robust DBML syntax fixing for diverse LLM output formats |
| `51c3d62` | Comprehensive README with full architecture and DBML fixer docs |
| `82c7240` | Handle streaming DBML output quirks and CompilerError diagnostics |

## Upstream

Based on [chartdb/chartdb](https://github.com/chartdb/chartdb). See the upstream repo for full ChartDB documentation, features, and contribution guidelines.

## License

Same as upstream — [AGPL-3.0](https://github.com/chartdb/chartdb/blob/main/LICENSE).
