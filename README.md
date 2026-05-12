# BoringDB

A browser-based database schema designer that lets you describe schemas in English, visualizes them via AI on the edge, and exports real DDL.

## Current State
Active — The app works locally and is deployed to Cloudflare Workers (db.getboring.io). It handles schema generation, visual editing, and exporting to various SQL dialects.

## Tech Stack
TypeScript, React, Vite, Tailwind CSS, Dexie (IndexedDB), Cloudflare Workers + Workers AI

## Key Dependencies
react, react-dom, @xyflow/react, monaco-editor, dexie, @dbml/core, ai, @ai-sdk/openai, tailwindcss

## Commands
- `pnpm install` — Install dependencies
- `pnpm run dev` — Run Vite dev server
- `pnpm run build` — Build the React app
- `pnpm run deploy` — Deploy via Wrangler
