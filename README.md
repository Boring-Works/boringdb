<p align="center">
  <img src="public/boringdb-logo.png" width="300" alt="BoringDB" />
</p>

<p align="center">
  <strong>The database schema designer that just works.</strong>
  <br />
  Describe it. See it. Export it. Done.
</p>

<p align="center">
  <a href="https://db.getboring.io"><strong>Try it now</strong></a>&nbsp;&nbsp;|&nbsp;&nbsp;<a href="#quick-start">Self-host</a>&nbsp;&nbsp;|&nbsp;&nbsp;<a href="#how-it-works">How it works</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-0d9488?style=flat" alt="AGPL-3.0" /></a>
</p>

---

## Why BoringDB

Most database design tools are either bloated desktop apps, SaaS products that hold your data hostage, or toys that can't export real SQL.

BoringDB is none of those.

- **Runs in your browser.** No install. No account. No data leaves your machine.
- **Describe what you need.** Type "e-commerce with users, products, orders, and reviews" and get a working schema.
- **Handles whatever the model throws.** DBML, SQL, markdown-wrapped code blocks — it auto-detects and parses it all.
- **Exports real DDL.** PostgreSQL, MySQL, SQLite, SQL Server, MariaDB, Oracle. Pick your dialect.
- **Exports Drizzle ORM.** Generate a complete `schema.ts` with proper types, modifiers, indexes, and relations.
- **50+ templates.** Start from real-world schemas — Laravel, Django, WordPress, AI/ML pipelines, and more.
- **Deploys on the edge.** One Cloudflare Worker. Static assets + schema generation. No origin server.

---

## How It Works

```
Describe your database in plain English
              |
              v
   Schema generated on the edge (Workers AI)
              |
              v
   Format auto-detected (DBML or SQL)
              |
              v
   Parsed and rendered as a visual ERD
              |
              v
   Edit tables, relationships, indexes visually
              |
              v
   Export as SQL, Drizzle ORM, PNG, SVG, or JSON
```

**Supported databases:** PostgreSQL, MySQL, SQLite, SQL Server, MariaDB, Oracle, CockroachDB

**Supported import formats:** DBML v2, SQL DDL (all dialects), JSON diagram

**Supported exports:** SQL DDL (all dialects), Drizzle ORM schema, PNG, JPG, SVG, JSON

---

## Key Features

### Visual ERD Editor
Drag-and-drop tables. Click to add fields, indexes, and constraints. Draw relationships between tables. Everything updates in real-time.

### AI Schema Generation
Describe your database in plain English and get a working schema generated on the edge via Cloudflare Workers AI. Supports DBML and SQL output with automatic format detection.

### Drizzle ORM Export
Export your visual schema as a complete Drizzle ORM `schema.ts` file. Supports `drizzle-orm/pg-core`, `drizzle-orm/mysql-core`, and `drizzle-orm/sqlite-core` with:
- Correct type mapping per dialect (60+ SQL types covered)
- Modifiers: `.primaryKey()`, `.notNull()`, `.unique()`, `.default()`, `.references()`, `.array()`
- Index generation with `index()` and `uniqueIndex()`
- Relations with `one()` and `many()` (respects cardinality)

### SQL Export
Export your diagram as DDL for any supported database. Cross-dialect translation (e.g., MySQL diagram → PostgreSQL DDL) uses AI; same-dialect export is deterministic.

### Smart Format Detection
The schema generator asks for DBML but models sometimes output SQL. BoringDB detects the format automatically and routes through the correct parser — DBML goes through `@dbml/core`, SQL goes through dialect-specific importers. No manual intervention needed.

### DBML Syntax Fixer
LLMs produce DBML with 15+ categories of syntax issues — uppercase keywords, bare SQL constraints, unquoted defaults, empty type params, inline enums. The `fixDBMLSyntax()` post-processor normalizes all of them before parsing.

### 50+ Schema Templates
Start from real-world database schemas across multiple categories:
- **Frameworks:** Laravel, Django, WordPress, Adonis, Voyager
- **Applications:** Twitter, Airbnb, Hacker News, Lobsters, Pixelfed
- **AI/ML:** RAG Pipeline, AI Gateway, Prompt Management, Evals Platform, Multi-Agent Orchestration, MCP Server Registry

---

## Quick Start

### Use it hosted

**[db.getboring.io](https://db.getboring.io)** — nothing to install.

### Self-host

```bash
git clone https://github.com/Boring-Works/boringdb.git
cd boringdb
npm install
npm run dev
```

Schema generation needs the Worker running locally:

```bash
wrangler dev
```

### Deploy your own

```bash
npm run build
npm run deploy
```

Configure in `public/config.js`:

```javascript
window.env = {
    OPENAI_API_ENDPOINT: '/api/v1',
    AI_DIAGRAM_MODEL: 'qwen2.5-coder-32b-instruct',
    OPENAI_API_KEY: 'proxy',
    DISABLE_ANALYTICS: 'true',
};
```

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Monaco Editor, React Flow |
| Hosting | Cloudflare Workers + Workers AI |
| Storage | Browser IndexedDB via Dexie.js (all data stays on your machine) |
| Parsing | @dbml/core (DBML v2), custom SQL dialect importers |
| Schema Gen | Vercel AI SDK, streaming SSE, format auto-detection |
| ORM Export | Custom Drizzle ORM code generator (deterministic, no AI) |

---

## Contributing

BoringDB is open source under AGPL-3.0. PRs welcome.

```bash
git clone https://github.com/Boring-Works/boringdb.git
cd boringdb
npm install
npm run dev
```

The codebase uses ESLint + Prettier for linting. Run `npm run lint` before submitting.

---

## License

**[AGPL-3.0](LICENSE)** — GNU Affero General Public License v3.0.

BoringDB is a modified version of [ChartDB](https://github.com/chartdb/chartdb), originally created by the ChartDB contributors and licensed under AGPL-3.0. All modifications from the upstream project are documented in the [NOTICE](NOTICE) file.

**What this means:**
- You can use, modify, and self-host BoringDB freely.
- If you modify and deploy it as a network service, you must make your source code available to users under the same AGPL-3.0 license.
- The full license text is in [LICENSE](LICENSE). The modification log is in [NOTICE](NOTICE).

**Source code:** [github.com/Boring-Works/boringdb](https://github.com/Boring-Works/boringdb)
**Upstream:** [github.com/chartdb/chartdb](https://github.com/chartdb/chartdb)

---

<p align="center">
  Built by <a href="https://getboring.io">Boring Works</a> in Johnson City, TN.
</p>
