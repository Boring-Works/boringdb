# BoringDB

Database schema designer. Visualize, design, and export your database diagrams. Live at **[db.getboring.io](https://db.getboring.io)**.

Built on [ChartDB](https://github.com/chartdb/chartdb) (AGPL-3.0), deployed on Cloudflare Workers.

## Features

- **Visual ERD Editor** — Drag-and-drop database diagram designer with real-time relationship visualization
- **Schema Generation** — Describe your database in plain English, get a visual ERD streamed in real-time
- **Smart Format Detection** — Automatically detects whether generated output is DBML or SQL and routes through the correct import pipeline
- **Multi-Dialect Support** — PostgreSQL, MySQL, SQLite, SQL Server, MariaDB, Oracle
- **SQL Export** — Export your diagrams to DDL scripts for any supported database
- **DBML Import/Export** — Full DBML v2 support with 15+ syntax normalizations for reliable parsing
- **Zero Backend** — All diagram data stored in browser IndexedDB. No accounts, no cloud dependency
- **Cloudflare Workers** — Single Worker handles static assets + API proxy to Workers AI

## Architecture

```
Browser (Vite SPA)
  |-- Static assets --> Cloudflare Workers Assets (./dist)
  |-- /api/v1/*     --> Worker (worker.ts)
                         |-- normalizeAIStream() converts SSE formats
                         |-- MODEL_MAP routes to Workers AI models
```

### Schema Generation Flow

```
User prompt --> streamText() via AI SDK --> Worker --> Workers AI
     |                                                    |
     |              <-- SSE stream (normalized) <---------|
     v
Monaco editor (live preview with auto-scroll)
     |
     v (user clicks "Create Diagram")
stripCodeFences() --> detectImportMethod()
     |                      |
     |--- DBML detected --> fixDBMLSyntax() --> @dbml/core Parser --> importDBMLToDiagram()
     |                                                                        |
     |--- SQL detected ---> sqlImportToDiagram() (auto-detects dialect)       |
                                    \                                         |
                                     --> stored in IndexedDB <---------------/
```

## Setup

### Prerequisites

- Node.js 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- Cloudflare account with Workers AI enabled

### Local Development

```bash
npm install
npm run dev        # Vite dev server at localhost:5173
wrangler dev       # Worker for AI features
```

### Build & Deploy

```bash
npm run build
wrangler deploy
```

### Configuration

Runtime config in `public/config.js`:

```javascript
window.env = {
    OPENAI_API_ENDPOINT: '/api/v1',
    AI_DIAGRAM_MODEL: 'qwen2.5-coder-32b-instruct',
    OPENAI_API_KEY: 'proxy',
    HIDE_CHARTDB_CLOUD: 'true',
    DISABLE_ANALYTICS: 'true',
};
```

## Key Files

| File | Purpose |
|------|---------|
| `worker.ts` | Cloudflare Worker — CORS, AI proxy, stream normalization, cache headers |
| `wrangler.toml` | Deployment config — routes, AI binding, model vars |
| `src/lib/data/ai-diagram/generate-diagram-from-prompt.ts` | Schema generation — system prompt, `fixDBMLSyntax()`, streaming |
| `src/dialogs/create-diagram-dialog/ai-generate-step.tsx` | Generate UI — prompt input, preview, format detection, import routing |
| `src/lib/data/sql-import/index.ts` | SQL DDL import — auto-detects dialect |
| `src/lib/import-method/detect-import-method.ts` | Format detection — DBML vs SQL vs JSON |

## Branding

BoringDB is a rebranded fork. The teal 4-node grid icon represents database relationships — clean, minimal, no frills.

**Brand color:** Teal-600 (`#0d9488`)

Logo files:
- `src/assets/logo-light.svg` — light backgrounds
- `src/assets/logo-dark.svg` — dark backgrounds
- `src/assets/icon.svg` — standalone icon mark
- `public/favicon.svg` — browser favicon

## License

AGPL-3.0 — same as upstream [chartdb/chartdb](https://github.com/chartdb/chartdb).

Source code: [github.com/getboring/chartdb](https://github.com/getboring/chartdb)
