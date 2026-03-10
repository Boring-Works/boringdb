# BoringDB

Database schema designer. Visualize, design, and export your database diagrams.

**[db.getboring.io](https://db.getboring.io)**

---

## What It Does

Describe a database in plain English. Get a visual ERD. Export DDL for any dialect.

- **Visual ERD Editor** — Drag-and-drop tables, draw relationships, design schemas visually
- **Schema Generation** — Describe what you need, get a working diagram streamed in real-time
- **Smart Import** — Paste DBML or SQL and it auto-detects the format. Supports PostgreSQL, MySQL, SQLite, SQL Server, MariaDB, Oracle
- **SQL Export** — Generate DDL scripts for any supported database from your diagram
- **Zero Backend** — Everything runs in your browser. No accounts. No data leaves your machine
- **Cloudflare Workers** — Static assets + Workers AI on a single edge deployment

## Quick Start

```bash
git clone https://github.com/Boring-Works/boringdb.git
cd boringdb
npm install
npm run dev
```

For schema generation features, run the Worker locally:

```bash
wrangler dev
```

### Deploy

```bash
npm run build
wrangler deploy
```

## How It Works

```
You describe a database
        ↓
Workers AI generates schema (DBML or SQL)
        ↓
Auto-detected → routed to correct parser
        ↓
Visual ERD in your browser (IndexedDB)
        ↓
Export as SQL for PostgreSQL, MySQL, SQLite, etc.
```

## Configuration

`public/config.js` — runtime config loaded before the app:

```javascript
window.env = {
    OPENAI_API_ENDPOINT: '/api/v1',
    AI_DIAGRAM_MODEL: 'qwen2.5-coder-32b-instruct',
    OPENAI_API_KEY: 'proxy',
    HIDE_CHARTDB_CLOUD: 'true',
    DISABLE_ANALYTICS: 'true',
};
```

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + Monaco Editor
- **Hosting:** Cloudflare Workers + Workers AI
- **Storage:** Browser IndexedDB (Dexie.js) — no server database
- **Parsing:** @dbml/core (DBML v2) + custom SQL dialect importers

## License

**AGPL-3.0** — see [LICENSE](LICENSE) and [NOTICE](NOTICE) for details.

This is a modified version of [ChartDB](https://github.com/chartdb/chartdb), originally created by the ChartDB contributors. All modifications are documented in the [NOTICE](NOTICE) file.

Under AGPL-3.0, you're free to use, modify, and distribute this software. If you deploy a modified version as a network service, you must make the source code available to users.

---

Built by [Boring Works](https://getboring.io) in Johnson City, TN.
