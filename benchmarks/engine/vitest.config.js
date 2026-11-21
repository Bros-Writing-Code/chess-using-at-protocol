import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    minWorkers: 1,
    maxWorkers: 1,
    exclude: [...configDefaults.exclude, '**/.delta/**'],
    benchmark: {
      include: ['benchmarks/engine/engine.bench.js'],
      outputJson: process.env.BENCH_RAW_OUTPUT,
    },
  },
});
