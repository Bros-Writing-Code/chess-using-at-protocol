// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// SITE_URL is the deployed URL, set by CI from the SITE_URL repo variable. Only its path
// becomes Vite's base. Unset locally, so dev serves from '/'. A domain change needs no
// edit here; see docs/deployment.md.
const siteUrl = process.env.SITE_URL;

export default defineConfig({
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