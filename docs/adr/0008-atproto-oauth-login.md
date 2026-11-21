# ADR 0008: Sign in with AT Protocol OAuth as a browser-only public client

- **Status:** Proposed
- **Date:** 2026-11-21
- **Deciders:** ATProto team
- **Related:** [Deployment](../deployment.md), ADR 0006

## Context

There is no game server, and moves are records in each player's PDS. Each player must therefore sign in with their own AT Protocol account from the browser. We have no backend to keep a client secret.

## Decision

- Use `@atproto/oauth-client-browser` as a public client (PKCE and DPoP, no secret). The library stores the tokens and restores the session on page load.
- Request only the `atproto` scope. We will widen it when we start writing records.
- In local dev the library's loopback client is used, so no metadata file is needed. In production, `vite.config.js` generates `client-metadata.json` from `SITE_URL`, and the build fails if `SITE_URL` lacks a trailing `/`.
- Resolve handles through `https://bsky.social`, and read profiles from Bluesky's public AppView.
- Everything from the network is rendered with `textContent`, never `innerHTML`.

## Consequences

**Positive**

- No server, no secret, and the library handles the token security.
- Local dev works without extra setup.

**Negative**

- `npm audit` reports a `zod` advisory (GHSA-mrhx-c7xc-m3w5, denial of service) through the `@atproto/*` packages. `zod` 3.x has no fix and the library pins `^3`. We accept the risk for now (the worst case is a crashed tab) and re-check before release.
- Handle lookups depend on `bsky.social`.
- Changing the site URL changes the `client_id`, so everyone has to sign in again.
