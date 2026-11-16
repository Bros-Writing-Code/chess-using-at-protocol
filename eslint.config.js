// @ts-check
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';

export default defineConfig([
  // `**/` because Vite builds into src/app/chessground-demo/dist, not the repo root.
  globalIgnores(['**/dist/', '**/coverage/']),
  {
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    // Tests and tooling run in Node, not the browser.
    files: ['**/*.test.js', '**/testing/**/*.js', '*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
]);