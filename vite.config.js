// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// SITE_URL is the deployed URL, set by CI from the SITE_URL repo variable. Only its path
// becomes Vite's base. Unset locally, so dev serves from '/'. A domain change needs no
// edit here; see docs/deployment.md.
const siteUrl = process.env.SITE_URL;

// ATProto OAuth identifies the app by the URL of this file. Local dev doesn't need it
// (auth.js uses the loopback client), so it's only emitted when SITE_URL is set.
function clientMetadata() {
  return {
    name: 'client-metadata',
    generateBundle() {
      if (!siteUrl) {
        return;
      }
      const base = new URL(siteUrl).href;
      // Without the trailing slash the client_id URL below would be wrong and login would break.
      if (!base.endsWith('/')) {
        throw new Error(`SITE_URL must end with "/" (got ${siteUrl})`);
      }
      const metadata = {
        client_id: `${base}client-metadata.json`,
        client_name: 'Knightsky',
        client_uri: base,
        redirect_uris: [base],
        scope: 'atproto',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        application_type: 'web',
        dpop_bound_access_tokens: true,
      };
      this.emitFile({
        type: 'asset',
        fileName: 'client-metadata.json',
        source: JSON.stringify(metadata, null, 2),
      });
    },
  };
}

export default defineConfig({
  plugins: [clientMetadata()],
  // The app being built. Change this when the demo is replaced (#13).
  root: 'src/app/chessground-demo',
  base: siteUrl ? new URL(siteUrl).pathname : '/',
  // Serve the Stockfish files straight from src/bot/assets/ at /stockfish/...
  // so they aren't duplicated. The path is relative to root.
  publicDir: '../../bot/assets',
  build: {
    // Fixed output folder, so the deploy job never cares which app is built.
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true, // needed because outDir is outside root
  },
});
