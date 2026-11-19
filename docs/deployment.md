# Deployment

The app is currently deployed on GitHub Pages at <https://knightsky.app/>.

## How it works

- For every PR the `CI` workflow (`.github/workflows/ci.yaml`) runs four separate checks: `lint`, `format`, `test` and `build`. PRs never deploy.
- For every push to `main` (a merged PR), the same checks run again, the build is packed, and the `deploy` job publishes it only if all four pass.
- `SITE_URL` is the only place the site's URL lives. It's a repo variable (Settings → Secrets and variables → Actions → Variables). `vite.config.js` turns its path into Vite's `base`. It's unset locally, so dev serves from `/`.
- The site uses a custom domain, so renaming the repo doesn't change its URL.

To check a production build locally:

```sh
export SITE_URL=https://knightsky.app/
npm run build
npx vite preview
```

## Notes for the UI and ATProto teams

### 1. Deep links 404 when opened directly

Pages only serves files that exist. A path like `.../game/abc` has no file, so pasting it or refreshing on it shows GitHub's 404 page. Clicking links inside the app still works. When routing is added there are two options that Claude suggested:

- **Hash routes** (`.../#/game/abc`): the part after `#` never reaches the server. Simplest. The URLs look less clean.
- **A `404.html` fallback:** copy `index.html` to `404.html` at build time, and the app reads the path itself. Clean URLs, but the HTTP status is still 404, which some link previews treat as an error.

Either way, build in app links from `import.meta.env.BASE_URL`, not a hard coded `/`.

### 2. ATProto login metadata needs to match the deployed URL

ATProto OAuth identifies the app by its `client_id`, the URL of a `client-metadata.json` that the site hosts. That `client_id` and the `redirect_uris` must use the exact URL the app is served from, or login fails.

- Generate the metadata from `SITE_URL` at build time. Never hard-code the URL. Vite only exposes `VITE_*` variables to app code, so this needs a `define` in `vite.config.js` or a renamed variable.
- Local dev uses ATProto's special localhost client instead of the deployed metadata.
- Changing the domain changes the `client_id`, so everyone has to log in again.

## Moving to a custom domain

This needs no code changes. Do these steps in one go.

1. Point the domain at GitHub by adding a DNS record at the registrar, following GitHub's
   [Managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) guide.
2. Set the `SITE_URL` repo variable to `https://<domain>/` (keep the trailing `/`).
3. Settings → Pages → Custom domain → enter the domain → Save.
4. Re-run the latest CI run on `main` (Actions → CI → Re-run all jobs), so the build uses the new URL.
5. Once GitHub's HTTPS certificate is ready, tick **Enforce HTTPS** on the same page.