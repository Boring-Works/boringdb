# Contributing to BoringDB

BoringDB is open source under [AGPL-3.0](LICENSE). Contributions are welcome.

## Getting Started

```bash
git clone https://github.com/Boring-Works/boringdb.git
cd boringdb
npm install
npm run dev
```

For AI schema generation, run the Worker locally:

```bash
wrangler dev
```

## Development

- **Lint:** `npm run lint` (ESLint + Prettier)
- **Typecheck:** `npx tsc --noEmit`
- **Test:** `npm test`
- **Build:** `npm run build`

## Pull Requests

1. Fork the repo and create your branch from `main`.
2. Make your changes.
3. Run `npm run lint` and `npm run build` before submitting.
4. Open a PR with a clear description of what changed and why.

## Code Style

- ESLint + Prettier (enforced by CI)
- TypeScript strict mode
- React functional components with hooks

## Reporting Issues

Use [GitHub Issues](https://github.com/Boring-Works/boringdb/issues) for bugs and feature requests.

For security vulnerabilities, see [SECURITY.md](SECURITY.md).
