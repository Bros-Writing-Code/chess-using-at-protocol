export const METHOD = 'engine-bench-v2';

export function settings(quick = false, rounds = quick ? 1 : 5) {
  const count = Number(rounds);
  if (!Number.isSafeInteger(count) || count < 1 || count > 100) {
    throw new Error('--rounds must be an integer from 1 to 100');
  }
  return {
    rounds: count,
    quick,
    timeMs: quick ? 20 : 300,
    minimumIterations: quick ? 1 : 5,
    warmupMs: quick ? 10 : 100,
    warmupIterations: quick ? 1 : 2,
  };
}

export function taskPrefixes(value = []) {
  const items = (Array.isArray(value) ? value : [value]).flatMap((item) =>
    item.split(',').map((part) => part.trim()),
  );
  if (items.some((item) => !item)) {
    throw new Error('Task prefixes must not be empty');
  }
  return [...new Set(items)].sort();
}

export function selectTasks(tasks, prefixes) {
  for (const prefix of prefixes) {
    if (!tasks.some((task) => task.id.startsWith(prefix))) {
      throw new Error(`Unknown task prefix: ${prefix}`);
    }
  }
  return tasks.filter(
    (task) => !prefixes.length || prefixes.some((prefix) => task.id.startsWith(prefix)),
  );
}
