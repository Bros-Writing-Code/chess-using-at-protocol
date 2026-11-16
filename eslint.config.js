// @ts-check
// Errors fail CI; warnings are printed but do not (see the `lint` script).
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import { importX, createNodeResolver } from 'eslint-plugin-import-x';
import vitest from '@vitest/eslint-plugin';
import sonarjs from 'eslint-plugin-sonarjs';

export default defineConfig([
  // `**/` because Vite builds into src/app/chessground-demo/dist, not the repo root.
  globalIgnores(['**/dist/', '**/coverage/']),
  {
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    plugins: { 'import-x': importX, sonarjs },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    settings: { 'import-x/resolver-next': [createNodeResolver()] },
    rules: {
      // Fail CI.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'import-x/no-unresolved': 'error', // imported file or package doesn't exist
      'import-x/named': 'error', // imported name isn't exported
      'import-x/default': 'error', // default import but no default export
      'import-x/namespace': 'error', // ns.foo where foo isn't exported

      // Warn only.
      complexity: ['warn', 15],
      'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }],
      'sonarjs/no-identical-functions': 'warn',
    },
  },
  {
    // The engine must stay independent of the UI and ATProto layers.
    files: ['src/engine/**/*.js'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          regex: '(^|/)(app|atproto)(/|$)|^@atproto/|^@lichess-org/chessground',
          message: 'Engine code must not import from the UI (src/app) or ATProto (src/atproto) layers.',
        }],
      }],
    },
  },
  {
    files: ['**/*.test.js'],
    plugins: { vitest },
    rules: {
      'vitest/expect-expect': 'error', // test with no assertions
      'vitest/no-focused-tests': 'error', // stray it.only / describe.only
      // describe() callbacks are naturally long; the limit is for real functions.
      'max-lines-per-function': 'off',
    },
  },
  {
    // Tests and tooling run in Node, not the browser.
    files: ['**/*.test.js', '**/testing/**/*.js', '*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
]);
