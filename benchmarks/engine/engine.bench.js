import { bench, describe } from 'vitest';
import { chessjs } from './adapters/chessjs.js';
import { loadOurs } from './adapters/ours.js';
import { selectTasks, settings, taskPrefixes } from './settings.js';
import { workloads } from './workloads.js';

const adapters = [await loadOurs(), chessjs];
if (Number(process.env.BENCH_ROUND || 0) % 2) {
  adapters.reverse();
}
const filter = taskPrefixes(process.env.BENCH_TASKS ? process.env.BENCH_TASKS : []);
const options = settings(process.env.BENCH_QUICK === '1');
const entries = adapters.flatMap((adapter) =>
  workloads(adapter).map((task) => ({ adapter, task })),
);
const selected = selectTasks(
  entries.map(({ task }) => task),
  filter,
);
for (const id of new Set(selected.map((task) => task.id))) {
  describe(id, () => {
    for (const { adapter, task } of entries.filter((entry) => entry.task.id === id)) {
      bench(`${adapter.id}::${task.id}`, task.run, {
        time: options.timeMs,
        iterations: options.minimumIterations,
        warmupTime: options.warmupMs,
        warmupIterations: options.warmupIterations,
        throws: true,
        // Vitest 2 forwards Bench options, not Task options. Tinybench exposes
        // per-iteration hooks on Task.opts; undo runs outside its timed region.
        setup(tinyTask) {
          tinyTask.opts.afterEach = task.afterEach;
        },
      });
    }
  });
}
