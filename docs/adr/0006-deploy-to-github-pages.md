# ADR 0006: Deploy to GitHub Pages from main, with the site URL in one repo variable

- **Status:** Proposed
- **Date:** 2026-11-16
- **Deciders:** CICD team
- **Related:** Issue #6, [Deployment](../deployment.md)

## Context

There is no game server, so the app is only static files. We need free hosting now, and a custom domain (knightsky) is coming later. The site URL is needed in Vite's base path now and in the ATProto login metadata later.

## Decision

- Host on GitHub Pages, published by the `deploy` job in `ci.yaml`. It runs only on pushes to `main`, after `lint`, `format`, `test` and `build` pass.
- The `SITE_URL` repo variable is the only place the URL lives. The build config and the login metadata can use it.

## Consequences

**Positive**

- Free, with no new accounts or tools.
- What's tested is exactly what ships.
- Switching to a custom domain only takes settings changes, with no code changes.

**Negative**

- Deep links 404 unless we use hash routes or a `404.html` fallback.
- `SITE_URL` lives outside git, so changes to it aren't in the repo history. `docs/deployment.md` documents it.
- During a domain switch, the site is blank for about a minute, until the rebuild finishes.

