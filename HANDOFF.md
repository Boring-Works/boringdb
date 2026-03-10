# ChartDB Fork — Handoff Prompt

Copy everything below the line into a new Claude session to continue work on this project.

---

## Project Context

You're working on a fork of ChartDB (open-source database diagram editor) deployed on Cloudflare Workers at **db.getboring.io**. The repo is at `/Users/codyboring/Projects/chartdb/` on the `boring/cloudflare-workers` branch, pushed to the `fork` remote at `https://github.com/getboring/chartdb.git`.

## What Was Built

An **AI Diagram Generator** that lets users describe a database in plain English and get a visual ERD. The full flow:

1. User types a prompt (e.g., "e-commerce with users, products, orders")
2. `generateDiagramFromPrompt()` streams DBML via Vercel AI SDK → Worker → Workers AI (qwen2.5-coder-32b-instruct)
3. `normalizeAIStream()` in `worker.ts` converts Workers AI's legacy `{"response":"..."}` SSE format to OpenAI's `{"choices":[{"delta":{"content":"..."}}]}` format
4. Monaco editor shows DBML streaming in real-time with auto-scroll
5. User clicks "Create Diagram" → `stripCodeFences()` → `fixDBMLSyntax()` → `@dbml/core` Parser (dbmlv2 format) → `importDBMLToDiagram()` → visual ERD in IndexedDB

## Key Files

| File | What It Does |
|------|-------------|
| `worker.ts` | Cloudflare Worker — CORS, dual-model AI proxy (`gpt-oss-120b` for SQL export, `qwen2.5-coder-32b-instruct` for diagrams), `normalizeAIStream()` for SSE format conversion |
| `src/lib/data/ai-diagram/generate-diagram-from-prompt.ts` | AI service — `buildSystemPrompt()` (database-type-aware), `fixDBMLSyntax()` (15+ regex fixes for LLM output), `generateDiagramFromPrompt()` (streaming). Exports `fixDBMLSyntax` for use by the UI. |
| `src/dialogs/create-diagram-dialog/ai-generate-step.tsx` | UI component — prompt textarea, Monaco DBML preview, Generate/Create buttons, error toasts with CompilerError diagnostic extraction, loading states |
| `src/dialogs/create-diagram-dialog/create-diagram-dialog.tsx` | Parent dialog — `importAiDiagram` callback that calls `importDBMLToDiagram()` |
| `src/lib/data/import-metadata/import-dbml.ts` | ChartDB's existing 1085-line DBML-to-diagram pipeline (uses `parser.parse(content, 'dbmlv2')`) |
| `public/config.js` | Runtime browser config — model names, API endpoint |
| `wrangler.toml` | Worker deployment config — routes, AI binding, model vars |
| `README.md` | Full architecture docs, DBML fixer reference table, commit history |

## What `fixDBMLSyntax()` Handles (15+ categories)

This is the critical function — it normalizes diverse LLM output into valid DBML before parsing. It fixes:

1. Uppercase TABLE/REF/ENUM keywords → lowercase
2. Inline `ENUM(admin, member)` types → `varchar(50)`
3. Bare SQL NOT NULL/UNIQUE/DEFAULT constraints → DBML bracket syntax `[unique, not null]`
4. Bare SQL DEFAULT with function calls → `[default: \`now()\`]`
5. Bare `default:` outside brackets → wrapped in `[default: ...]`
6. Bare function defaults without backticks → backtick-wrapped
7. Bare identifier defaults (e.g., `default: subscriber`) → quoted `default: 'subscriber'`
8. Empty default annotations `[default:]` → removed
9. Empty type parens `varchar()`, `numeric()`, `decimal()` → filled with defaults
10. Quoted enum values `'admin'` → unquoted `admin`
11. Bare `index(field)` lines → `indexes { field }` blocks
12. Bare `unique(field1, field2)` → `indexes { (field1, field2) [unique] }`
13. Bare `primary key (field1, field2)` → `indexes { (field1, field2) [pk] }`
14. Truncated `not` inside brackets → `not null`
15. Bare `index` attribute inside brackets → removed
16. Inline `check(...)` constraints → removed (not valid DBML)
17. Markdown code fences → stripped

## Critical Gotchas

### CompilerError is NOT an Error
`@dbml/core` throws `CompilerError` which does **not** extend `Error`. `instanceof Error` is false. It has no `.message` property. It has a `.diags` array: `[{ message: string, location: { start: { line: number } } }]`. The catch block in `ai-generate-step.tsx` handles this explicitly.

### `dbmlv2` not `dbml`
The real import pipeline uses `parser.parse(content, 'dbmlv2')`. These are different parser formats with different syntax requirements. All testing must use `dbmlv2`.

### Streaming vs Non-Streaming Quality
The streaming endpoint produces significantly worse DBML quality than non-streaming. Common streaming issues: truncated attributes (`[unique, not]`), SQL-style syntax, bare `index` attributes, inline `check()` constraints. All handled by `fixDBMLSyntax()`.

### AI SDK v5 + Chat Completions
`@ai-sdk/openai` v2.x defaults to the Responses API. Must use `openai.chat(modelName)` to force Chat Completions API, which is what the Worker implements.

## Current State (as of 2026-03-10)

- **Branch:** `boring/cloudflare-workers` (13 commits ahead of upstream, latest `82c7240`)
- **Deployed:** Version `b2cee960` at db.getboring.io
- **Working tree:** Clean (HANDOFF.md and README.md staged)
- **Build:** Passes (`npm run build`)
- **Lint:** Passes (ESLint)
- **Feature status:** Fully functional end-to-end
- **Tested against:** 6 live API responses (3 non-streaming, 2 streaming, 1 blog) — all parse successfully with `dbmlv2`

## Known Limitations / Future Work

1. **Model non-determinism** — The qwen model sometimes outputs new syntax variations. `fixDBMLSyntax()` handles all known patterns but new ones may emerge. Console.log debugging is in place — check browser console for `[AI Diagram] Cleaned DBML for import:` on failures.
2. **No streaming indicator on the Worker** — If Workers AI is slow, user sees nothing until first token. Could add "Connecting..." state.
3. **Single model for diagrams** — Hardcoded to `qwen2.5-coder-32b-instruct`. Could add model selection UI.
4. **No retry on generation failure** — User must manually click Generate again on 500 errors.
5. **Inline ENUM() fallback** — `ENUM(admin, member)` → `varchar(50)` loses semantic info. Could extract into Enum blocks instead.
6. **No edit-after-generate** — Monaco is read-only during generation. Could make editable after completion.

## Test Files in /tmp

These are saved live API responses used to validate `fixDBMLSyntax()`:

| File | Content |
|------|---------|
| `/tmp/live_dbml_raw.txt` | E-commerce non-streaming (11 tables) |
| `/tmp/live_dbml_v2.txt` | SQL-style project management (7 tables) |
| `/tmp/live_dbml_v3.txt` | Social media with enums (8 tables) |
| `/tmp/streamed_dbml.txt` | Streaming output (needs heavy fixing) |
| `/tmp/browser_dbml.txt` | Blog non-streaming |
| `/tmp/test_all_v3.cjs` | Test runner for all 5 responses |
| `/tmp/test_fresh.cjs` | Single test for streaming response |

Run: `node /tmp/test_all_v3.cjs` to validate all responses parse.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite 7, Tailwind CSS, @xyflow/react (canvas), Monaco Editor, Dexie.js (IndexedDB)
- **AI:** Vercel AI SDK v5 (`ai` + `@ai-sdk/openai`), Workers AI (qwen2.5-coder-32b-instruct, gpt-oss-120b)
- **Infrastructure:** Cloudflare Workers, Workers Assets, custom domain routing
- **DBML:** `@dbml/core` parser (must use `dbmlv2` format)
- **Linting:** ESLint + Prettier (configured in the project)

## Commands

```bash
npm run dev          # Vite dev server at localhost:5173
wrangler dev         # Worker dev server (needed for AI features)
npm run build        # Production build to ./dist
wrangler deploy      # Deploy to Cloudflare Workers
git push fork boring/cloudflare-workers  # Push to GitHub fork
node /tmp/test_all_v3.cjs               # Run DBML parser tests against saved API responses
```
