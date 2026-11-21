import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const positive = (value) => Number.isFinite(value) && value > 0;
const key = (row) => `${row.engine}::${row.task}`;
function unique(rows, getKey) {
  if (new Set(rows.map(getKey)).size !== rows.length) {
    throw new Error('Duplicate benchmark task or run');
  }
}
export function median(values) {
  if (!values.length || values.some((n) => !Number.isFinite(n))) {
    throw new Error('Expected finite nonempty samples');
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function measurement(row) {
  if (
    row.error ||
    !positive(row.median) ||
    !positive(row.mean) ||
    !Number.isSafeInteger(row.sampleCount) ||
    row.sampleCount < 1 ||
    !/^(ours|chessjs)::.+$/.test(row.name)
  ) {
    throw new Error(`Invalid benchmark measurement: ${row.name}`);
  }
  // Discard potentially millions of raw samples after extracting round statistics.
  return { name: row.name, median: row.median, mean: row.mean, sampleCount: row.sampleCount };
}
export function extract(raw) {
  const output = [];
  function walk(value) {
    if (!value || typeof value !== 'object') {
      return;
    }
    if (typeof value.name === 'string' && value.name.includes('::') && 'mean' in value) {
      output.push(measurement(value));
      return;
    }
    for (const child of Object.values(value)) {
      walk(child);
    }
  }
  walk(raw);
  if (!output.length) {
    throw new Error('Vitest JSON contained no measured tasks');
  }
  unique(output, (row) => row.name);
  return output;
}
function summary(name, rounds, descriptor) {
  const rows = rounds.map((round) => round.find((r) => r.name === name));
  const [engine, task] = name.split('::');
  const batchSize = descriptor.batchSize || 1;
  const times = rows.map((r) => r.median / batchSize);
  const count = rows.reduce((n, r) => n + r.sampleCount, 0);
  const medianMs = median(times);
  return {
    engine,
    task,
    unit: descriptor.unit,
    batchSize,
    workUnits: descriptor.workUnits,
    rounds: rows.length,
    sampleCount: count,
    medianMs,
    meanMs: rows.reduce((n, r) => n + r.mean * r.sampleCount, 0) / count / batchSize,
    opsPerSecond: 1000 / medianMs,
    roundMinMs: Math.min(...times),
    roundMaxMs: Math.max(...times),
  };
}
export function summarize(rounds, descriptors) {
  if (!rounds.length || !rounds[0].length) {
    throw new Error('Expected nonempty measurement rounds');
  }
  const expected = descriptors.map(key).sort();
  unique(descriptors, key);
  for (const round of rounds) {
    round.forEach(measurement);
    unique(round, (row) => row.name);
    if (JSON.stringify(round.map((r) => r.name).sort()) !== JSON.stringify(expected)) {
      throw new Error('Round task sets differ from requested workloads');
    }
  }
  return expected.map((name) =>
    summary(
      name,
      rounds,
      descriptors.find((d) => key(d) === name),
    ),
  );
}
export function ratios(rows) {
  return rows
    .filter((r) => r.engine === 'ours')
    .flatMap((row) => {
      const reference = rows.find((r) => r.engine === 'chessjs' && r.task === row.task);
      return reference
        ? [{ task: row.task, oursOverChessjs: row.medianMs / reference.medianMs }]
        : [];
    });
}
export function compatibility(run) {
  const m = run.metadata;
  const s = m.settings;
  // Filtering tasks does not change how shared tasks are measured.
  return JSON.stringify([
    m.method,
    m.methodHash,
    m.fixtureHash,
    m.node,
    m.machine.id,
    m.machine.os,
    m.chessjsVersion,
    m.vitestVersion,
    m.tinybenchVersion,
    s.rounds,
    s.quick,
    s.timeMs,
    s.minimumIterations,
    s.warmupMs,
    s.warmupIterations,
  ]);
}
export function compareRuns(before, after) {
  if (compatibility(before) !== compatibility(after)) {
    throw new Error(
      'Incompatible environments/methods/settings; rerun both versions with matching settings',
    );
  }
  const rows = after.results.flatMap((row) => {
    const old = before.results.find((r) => key(r) === key(row));
    return old
      ? [
          {
            engine: row.engine,
            task: row.task,
            beforeMs: old.medianMs,
            afterMs: row.medianMs,
            speedup: old.medianMs / row.medianMs,
            changePercent: (row.medianMs / old.medianMs - 1) * 100,
          },
        ]
      : [];
  });
  if (!rows.length) {
    throw new Error('No shared tasks to compare');
  }
  return rows;
}
export function csv(rows) {
  if (!rows.length) {
    return '';
  }
  const keys = Object.keys(rows[0]);
  const quote = (value) => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  return (
    [keys, ...rows.map((row) => keys.map((k) => row[k]))]
      .map((row) => row.map(quote).join(','))
      .join('\n') + '\n'
  );
}
function validateRow(row) {
  const times = [
    row.medianMs,
    row.meanMs,
    row.opsPerSecond,
    row.roundMinMs,
    row.roundMaxMs,
    row.workUnits,
  ];
  if (
    !['ours', 'chessjs'].includes(row.engine) ||
    typeof row.task !== 'string' ||
    !row.task ||
    !times.every(positive) ||
    row.roundMinMs > row.medianMs ||
    row.medianMs > row.roundMaxMs ||
    !Number.isSafeInteger(row.rounds) ||
    row.rounds < 1 ||
    !Number.isSafeInteger(row.sampleCount) ||
    row.sampleCount < row.rounds ||
    typeof row.unit !== 'string' ||
    !row.unit
  ) {
    throw new Error('Invalid benchmark summary task');
  }
}
export function validateRun(run) {
  const m = run?.metadata;
  if (
    run?.schemaVersion !== 1 ||
    typeof run.runId !== 'string' ||
    !run.runId ||
    !m ||
    !Number.isFinite(Date.parse(m.date)) ||
    !m.commit ||
    !m.methodHash ||
    !m.fixtureHash ||
    !m.node ||
    !m.machine?.id ||
    !m.machine.os ||
    !m.settings ||
    !Array.isArray(run.results) ||
    !run.results.length
  ) {
    throw new Error('Invalid benchmark summary metadata');
  }
  run.results.forEach(validateRow);
  unique(run.results, key);
  return run;
}
export function readRun(file) {
  try {
    return validateRun(JSON.parse(readFileSync(file, 'utf8')));
  } catch (error) {
    throw new Error(`${file}: ${error.message}`, { cause: error });
  }
}
export function readRuns(directory, ids = []) {
  const runs = readdirSync(directory)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => readRun(resolve(directory, f)));
  unique(runs, (run) => run.runId);
  for (const id of ids) {
    if (!runs.some((run) => run.runId === id)) {
      throw new Error(`Unknown run ID: ${id}`);
    }
  }
  return runs.filter((run) => !ids.length || ids.includes(run.runId));
}
