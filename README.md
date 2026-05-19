<div align="center">
  <img src="https://raw.githubusercontent.com/Boring-Works/boringdb/main/public/boringdb-logo.png" width="96" alt="BoringDB logo" />
  <h1>BoringDB</h1>
  <p><strong>Visual database schema designer that runs entirely on Cloudflare Workers.<br/>Describe your schema in plain English. Get a diagram. Export real SQL. No API key required.</strong></p>

  <a href="https://db.getboring.io"><img src="https://img.shields.io/badge/Live_Demo-db.getboring.io-22c55e?style=flat-square&logo=cloudflare&logoColor=white" alt="Live Demo" /></a>
  &nbsp;
  <img src="https://img.shields.io/badge/Cloudflare_Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare Workers" />
  &nbsp;
  <img src="https://img.shields.io/badge/Workers_AI-free_tier-F38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Workers AI" />
  &nbsp;
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  &nbsp;
  <img src="https://img.shields.io/badge/React_18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 18" />
  &nbsp;
  <img src="https://img.shields.io/badge/license-AGPL--3.0-6366f1?style=flat-square" alt="License: AGPL-3.0" />

  <br /><br />

  <a href="https://db.getboring.io">
    <img src="https://raw.githubusercontent.com/Boring-Works/boringdb/main/public/social-preview.png" width="100%" alt="BoringDB screenshot" />
  </a>
</div>

---

## Why this fork exists

The original [ChartDB](https://github.com/chartdb/chartdb) is excellent — but it needs an OpenAI key and a separate backend to power the AI features. This fork removes both requirements.

Everything runs as a **single Cloudflare Worker**: the static app, the AI proxy, and the stream handler. Deploy it in under two minutes on Cloudflare's free tier. No secrets to manage, no server to run, no monthly AI bill.

---

## Features

- **AI schema generation** — describe a schema in plain English and get a visual diagram back, powered by Cloudflare Workers AI. No OpenAI key. No external API calls.
- **Visual editor** — drag tables, draw relationships, edit columns and types inline with full keyboard support.
- **Multi-dialect SQL export** — generates production-ready DDL for PostgreSQL, MySQL, SQLite, SQL Server, and MariaDB.
- **Import anything** — paste raw SQL DDL or DBML and the diagram builds automatically. Format is detected automatically.
- **Local-first storage** — all diagrams live in your browser via IndexedDB. Nothing leaves your machine.
- **Two specialized models** — `qwen2.5-coder-32b-instruct` for schema generation (code-tuned), `gpt-oss-120b` for general queries.

---

## How the AI works

Workers AI returns a legacy SSE format (`{"response":"..."}`) that is incompatible with the Vercel AI SDK, which expects OpenAI-style chunks (`{"choices":[{"delta":{"content":"..."}}]}`). The Worker normalizes the stream in real time so the frontend never knows the difference:

```
Browser → POST /api/v1/chat/completions
           ↓
       worker.ts
           ↓ resolveModel() — maps short name to @cf/... path
           ↓ env.AI.run()   — Workers AI with stream: true
           ↓ normalizeAIStream() — legacy → OpenAI SSE format
           ↓
Browser ← text/event-stream (OpenAI-compatible)
```

Models often output SQL DDL even when prompted for DBML. `detectImportMethod()` inspects the output and routes it through the correct parser automatically — no prompt engineering required.

---

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Visual editor | React Flow (`@xyflow/react`) |
| Code editor | Monaco Editor |
| Schema parsing | `@dbml/core` (DBML v2), custom SQL dialect importers |
| Storage | IndexedDB via Dexie — local-first, zero backend |
| AI | Cloudflare Workers AI (free tier) |
| Hosting | Single Cloudflare Worker — static assets + AI proxy |
| Deployment | Wrangler + GitHub Actions / CF Workers Builds |

---

## Quick start

```bash
npm install

# Terminal 1 — Vite dev server
npm run dev

# Terminal 2 — Workers AI proxy (requires a Cloudflare account)
npx wrangler dev
```

App runs at `http://localhost:5173`. AI features proxy through Wrangler on `:8787`.

---

## Deploy your own

Requires a [Cloudflare account](https://dash.cloudflare.com/sign-up) with Workers AI enabled (free tier works).

```bash
npm install
npm run build
npm run deploy
```

Then add a Custom Domain in the Cloudflare dashboard pointing to your `chartdb` Worker. See [CLAUDE.md](CLAUDE.md) for the full routing setup.

---

## What this changes from upstream

| Upstream (ChartDB) | This fork (BoringDB) |
|--------------------|----------------------|
| Requires OpenAI API key | Cloudflare Workers AI — no key needed |
| Separate AI backend | Single Worker handles everything |
| Node/Express server | Edge-native, deploys globally in seconds |
| OpenAI stream format | Legacy Workers AI stream normalized at the edge |
| DBML output only | DBML and SQL DDL detected and parsed automatically |

---

## Attribution

BoringDB is a fork of [ChartDB](https://github.com/chartdb/chartdb) by the ChartDB contributors, licensed under [AGPL-3.0](LICENSE). See [NOTICE](NOTICE) for the full list of modifications from upstream.
