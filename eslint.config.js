// @ts-check
// Errors fail CI; warnings don't.
import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import { importX, createNodeResolver } from 'eslint-plugin-import-x';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';

export default defineConfig([
  // Vite builds into dist/.
  // src/bot/assets is a minified third-party Stockfish build.
  // .delta/ holds the git worktrees of Delta agents inside a local checkout;
  // without this, linting from the checkout also lints duplicate repo copies.
  globalIgnores(['**/dist/', '**/coverage/', 'src/bot/assets/', '**/.delta/']),
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
      // Braces on every if, even one-liners.
      curly: ['error', 'all'],
      // Built-ins, packages, then our files, each A-Z with no blank lines. CSS imports stay put.
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'never',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      // Warn only.
      complexity: ['warn', 25],
      'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }],
      'sonarjs/no-identical-functions': 'warn',
    },
  },
  {
    // The engine must stay independent of the UI and ATProto layers.
    files: ['src/engine/**/*.js'],
    rules: {
      // Matches resolved paths, so any ../ depth and import() are caught.
      'import-x/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/engine',
              from: ['./src/app', './src/atproto'],
              message: 'Engine code must not import from the UI or ATProto layers.',
            },
          ],
        },
      ],
      // Their libraries too, so the folder rule can't be bypassed.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@atproto/*', '@lichess-org/chessground', '@lichess-org/chessground/*'],
              message: 'Engine code must not import UI or ATProto libraries.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.js'],
    plugins: { vitest },
    rules: {
      'vitest/expect-expect': 'error', // test with no assertions
      'vitest/no-focused-tests': 'error', // stray it.only / describe.only
      // describe() blocks are naturally long.
      'max-lines-per-function': 'off',
    },
  },
  {
    // Tests and tooling run in Node, not the browser.
    files: ['**/*.test.js', '**/testing/**/*.js', '*.config.js', 'benchmarks/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
]);
