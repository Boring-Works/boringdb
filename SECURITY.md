# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in BoringDB, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, email **security@getboring.io** with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact

We will acknowledge receipt within 48 hours and aim to provide a fix within 7 days for critical issues.

## Scope

BoringDB runs entirely in the browser. Your database schemas are stored locally in IndexedDB and never leave your machine. The only server-side component is the Cloudflare Worker that proxies AI schema generation requests.

Security concerns include:
- XSS in the visual editor or import pipeline
- Data exfiltration from browser storage
- Worker API abuse or injection
- Supply chain vulnerabilities in dependencies

## Supported Versions

Only the latest deployed version at [db.getboring.io](https://db.getboring.io) is supported.
