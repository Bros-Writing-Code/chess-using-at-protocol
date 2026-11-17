// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// SITE_URL is the deployed URL, set by CI from the SITE_URL GitHub repo variable.
// Only its path is used here, as Vite's base:
//   https://bros-writing-code.github.io/chess-using-at-protocol/  ->  /chess-using-at-protocol/
//   https://<custom-domain>/                                       ->  /
// To move to a custom domain, don't edit this file. Change the repo variable,
// set the domain in Settings -> Pages, and add the DNS record (see docs).
// It's unset locally, so dev and local builds serve from '/'.
const siteUrl = process.env.SITE_URL;

export default defineConfig({
  // The app being built. Change this when the demo is replaced (#13).
  root: 'src/app/chessground-demo',
  base: siteUrl ? new URL(siteUrl).pathname : '/',
  build: {
    // Fixed output folder, so the deploy job never cares which app is built.
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true, // needed because outDir is outside root
  },
});