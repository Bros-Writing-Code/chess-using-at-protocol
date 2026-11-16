// @ts-check
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      // Delta keeps its git worktrees under .delta/ inside a local checkout;
      // without this, a run from the checkout collects duplicate test copies.
      '**/.delta/**',
    ],
  },
});
