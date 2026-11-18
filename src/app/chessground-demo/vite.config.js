import { defineConfig } from 'vite';

// Serve the Stockfish files straight from src/bot/assets/ at /stockfish/...
// so they aren't duplicated. The path is relative to this folder.
export default defineConfig({
  publicDir: '../../bot/assets',
});