# CLAUDE.md — BoringDB

## What This Is
BoringDB is a database schema designer that runs entirely in the browser. Fork of [ChartDB](https://github.com/chartdb/chartdb) under AGPL-3.0. Deployed at **db.getboring.io**.

## Quick Start
```bash
npm install
npm run dev          # Vite dev server on :5173
npx wrangler dev     # Worker for AI schema generation
npm run build        # Production build → dist/
npm run deploy       # Deploy to Cloudflare (runs wrangler deploy)
```

## Stack
| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Monaco Editor, React Flow |
| Hosting | Cloudflare Workers + Workers AI |
| Storage | Browser IndexedDB via Dexie.js (`new Dexie('ChartDB')` — DO NOT rename or users lose data) |
| Parsing | @dbml/core (DBML v2), custom SQL dialect importers |
| Schema Gen | Vercel AI SDK, streaming SSE, format auto-detection |

## Architecture

### Worker (`worker.ts`)
- Routes `/api/v1/chat/completions` to Workers AI
- Normalizes legacy Workers AI stream format → OpenAI SSE format
- Serves static assets from `dist/` with no-cache headers on HTML
- CORS: db.getboring.io, localhost:5173

### AI Schema Generation
- System prompt requests DBML but models often output SQL
- `detectImportMethod()` auto-detects format (DBML vs SQL DDL)
- DBML → `fixDBMLSyntax()` → `importDBMLToDiagram()`
- SQL → `sqlImportToDiagram()` with dialect detection
- Key file: `src/dialogs/create-diagram-dialog/ai-generate-step.tsx`

### Models (wrangler.toml vars)
- `AI_MODEL`: gpt-oss-120b (general purpose)
- `AI_DIAGRAM_MODEL`: qwen2.5-coder-32b-instruct (code/schema gen)

## Key Files
| File | Purpose |
|------|---------|
| `worker.ts` | CF Worker — AI proxy + asset serving |
| `wrangler.toml` | Worker config (name=`chartdb`, can't rename due to route binding) |
| `public/config.js` | Runtime env vars (API endpoint, model, analytics toggle) |
| `src/dialogs/create-diagram-dialog/` | AI generate + import pipeline |
| `src/lib/data/sql-import/` | SQL DDL importers per dialect |
| `src/lib/dbml/` | DBML import/export + syntax fixer |
| `src/lib/data/sql-export/` | SQL DDL exporters per dialect |
| `src/context/chartdb-context/` | Core app state (internal name, don't rename) |
| `src/context/storage-context/` | Dexie IndexedDB persistence |
| `src/i18n/locales/` | 22 locale files |
| `NOTICE` | AGPL-3.0 compliance — modifications from upstream |

## Deployment
- **GitHub:** github.com/Boring-Works/boringdb (public)
- **Worker name:** `chartdb` (kept for route binding — cosmetic only)
- **Route:** db.getboring.io/* → zone getboring.io (managed by wrangler.toml, NOT the dashboard)
- **CI/CD:** Cloudflare Workers Builds (dashboard-configured, auto-deploys on push to main)
  - Build command: `npm run build`
  - Deploy command: `npm run deploy`
  - Build cache: Enabled
- **Local branch:** `boring/cloudflare-workers` pushes to remote `main`
- **Local deploy:** `npm run build && npm run deploy`

### Workers Builds Gotchas
- `.nvmrc` controls Node version (currently v24, Workers Builds respects it)
- `wrangler` is pinned as a devDependency — do NOT rely on npx downloading it
- Routes MUST be in `wrangler.toml`, NOT the CF dashboard, or deploys fail with error 10020
- Build needs `NODE_OPTIONS='--max-old-space-size=4096'` — Monaco Editor causes OOM at 2GB default

## Branding
- Logo source: `/Users/codyboring/Downloads/BoringDB-logo.jpeg` (2048x2048)
- Logo variants: `src/assets/logo-light.png`, `logo-dark.png`, `icon.png`
- Empty state: `src/assets/empty_state.png`, `empty_state_dark.png` (grid icon)
- Favicon: `public/favicon.png` (32px)
- Social preview: `public/social-preview.png` (1280x640)
- Icon sizes: `public/icon-{32,48,64,128,180,192,512}.png`

## Important Rules
1. **Dexie DB name is `ChartDB`** — changing it breaks all existing user data
2. **Internal code names** (`useChartDB`, `chartdb-context`, `ChartDBProvider`) are internal identifiers. Renaming = massive refactor with no user benefit.
3. **Worker name is `chartdb`** in wrangler.toml — can't rename because routes are bound to it
4. **AGPL-3.0** — NOTICE file documents all modifications. Source link in sidebar footer.
5. **No "AI" in branding** — it's "Database Schema Designer", not "AI Database Schema Designer"
6. **Analytics disabled** — Fathom script exists but `DISABLE_ANALYTICS: 'true'` in config.js

## Remaining ChartDB References (intentional)
These are internal code identifiers that would break things if renamed:
- `useChartDB` hook, `ChartDBProvider`, `chartdb-context/` — core state management
- `HIDE_CHARTDB_CLOUD` env var — controls cloud feature visibility
- `Dexie('ChartDB')` — IndexedDB database name (user data!)
- `wrangler.toml name = "chartdb"` — worker route binding

## Decisions
| Decision | Reason |
|----------|--------|
| Keep Dexie DB name | Changing loses all user diagrams |
| Keep worker name | Route binding, cosmetic only |
| Keep internal code names | Massive refactor, no user-facing benefit |
| PNG logos not SVG | Generated from user's custom JPEG |
| DBML + SQL dual import | Models output SQL despite DBML prompt |
| Stream normalization in worker | Workers AI legacy format breaks AI SDK |
| `run_worker_first = true` | Needed for HTML cache-busting headers |
| Routes in wrangler.toml only | Dashboard route + wrangler.toml = 10020 conflict on deploy |
| `NODE_OPTIONS` 4GB heap | Monaco Editor OOMs the 2GB default in CI |
| wrangler as devDependency | Prevents CI from downloading fresh copy every build |
| `manualChunks` for monaco/react-flow | Reduces peak memory during Vite bundling |
| `localStorage` try/catch in utils.ts | `getWorkspaceId()` must work in Node test environments |
