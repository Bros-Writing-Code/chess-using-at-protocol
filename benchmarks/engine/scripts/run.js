import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chessjs } from '../adapters/chessjs.js';
import { loadOurs } from '../adapters/ours.js';
import { METHOD, selectTasks, settings, taskPrefixes } from '../settings.js';
import { validate } from '../validate.js';
import { workloads } from '../workloads.js';
import { csv, extract, ratios, summarize, validateRun } from './results.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(root);
const { values } = parseArgs({
  options: {
    'engine-root': { type: 'string' },
    label: { type: 'string', default: '' },
    rounds: { type: 'string' },
    quick: { type: 'boolean', default: false },
    tasks: { type: 'string' },
    output: { type: 'string', default: 'benchmarks/engine/results' },
    'keep-raw': { type: 'boolean', default: false },
  },
});
const engineRoot = resolve(values['engine-root'] || root);
process.env.BENCH_ENGINE_ROOT = engineRoot;
const sampling = settings(values.quick, values.rounds);
const prefixes = taskPrefixes(values.tasks === undefined ? [] : values.tasks);
const roundCount = sampling.rounds;
const git = (cwd, ...args) =>
  execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
const hash = (data) => createHash('sha256').update(data).digest('hex');
function hashFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      if (
        ['results', 'charts', 'node_modules', 'testing'].includes(entry.name) ||
        ['charts.js', 'compare.js', 'generate-fixtures.js'].includes(entry.name)
      ) {
        return [];
      }
      const path = resolve(directory, entry.name);
      return entry.isDirectory()
        ? hashFiles(path)
        : entry.name.endsWith('.js')
          ? [entry.name, readFileSync(path)]
          : [];
    });
}
const descriptors = selectTasks(
  [await loadOurs(), chessjs].flatMap((adapter) =>
    workloads(adapter).map((task) => ({ ...task, engine: adapter.id, task: task.id })),
  ),
  prefixes,
);
const directory = resolve(values.output);
mkdirSync(directory, { recursive: true });
console.log('Validating fixed inputs before measurement…');
const validation = await validate({ quick: values.quick });
const methodHash = () =>
  hash(
    Buffer.concat(hashFiles(resolve(root, 'benchmarks/engine')).map((part) => Buffer.from(part))),
  );
const engineSourceHash = () =>
  hash(
    Buffer.concat(hashFiles(resolve(engineRoot, 'src/engine')).map((part) => Buffer.from(part))),
  );
const metadata = {
  commit: git(engineRoot, 'rev-parse', 'HEAD'),
  date: new Date().toISOString(),
  label: values.label,
  engineDirty: Boolean(git(engineRoot, 'status', '--porcelain', '--', 'src/engine')),
  engineTree: git(engineRoot, 'rev-parse', 'HEAD:src/engine'),
  engineSourceHash: engineSourceHash(),
  harnessCommit: git(root, 'rev-parse', 'HEAD'),
  harnessDirty: Boolean(git(root, 'status', '--porcelain')),
  method: METHOD,
  methodHash: methodHash(),
  fixtureHash: validation.fixtureHash,
  node: process.version,
  machine: {
    id: hash(os.hostname() + os.cpus()[0].model + os.arch()).slice(0, 16),
    cpu: os.cpus()[0].model,
    arch: os.arch(),
    os: `${os.platform()} ${os.release()}`,
    logicalCpus: os.cpus().length,
    memoryBytes: os.totalmem(),
  },
  chessjsVersion: JSON.parse(
    readFileSync(resolve(root, 'node_modules/chess.js/package.json'), 'utf8'),
  ).version,
  vitestVersion: JSON.parse(readFileSync(resolve(root, 'node_modules/vitest/package.json'), 'utf8'))
    .version,
  tinybenchVersion: JSON.parse(
    readFileSync(resolve(root, 'node_modules/tinybench/package.json'), 'utf8'),
  ).version,
  settings: { ...sampling, tasks: prefixes.length ? prefixes.join(',') : 'all' },
  capabilities: { pgn: validation.pgn },
};
const runId = `${metadata.date.replaceAll(/[:.]/g, '-')}-${metadata.commit.slice(0, 7)}${values.quick ? '-quick' : ''}`;
const temporary = mkdtempSync(resolve(os.tmpdir(), 'engine-bench-'));
const rounds = [];
try {
  for (let i = 0; i < roundCount; i++) {
    console.log(`Measurement round ${i + 1}/${roundCount}`);
    const output = resolve(temporary, `round-${i + 1}.json`);
    const result = spawnSync(
      process.execPath,
      [
        resolve(root, 'node_modules/vitest/vitest.mjs'),
        'bench',
        '--run',
        '--config',
        'benchmarks/engine/vitest.config.js',
      ],
      {
        cwd: root,
        stdio: 'inherit',
        env: {
          ...process.env,
          BENCH_RAW_OUTPUT: output,
          BENCH_ROUND: String(i),
          BENCH_QUICK: values.quick ? '1' : '0',
          BENCH_TASKS: prefixes.join(','),
        },
      },
    );
    if (result.error || result.status !== 0) {
      throw result.error || new Error(`Vitest failed: ${result.status}`);
    }
    rounds.push(extract(JSON.parse(readFileSync(output, 'utf8'))));
  }
  const results = summarize(rounds, descriptors);
  if (metadata.methodHash !== methodHash() || metadata.engineSourceHash !== engineSourceHash()) {
    throw new Error('Source changed during measurement; results were not saved');
  }
  const comparisons = ratios(results);
  const summary = validateRun({ schemaVersion: 1, runId, metadata, results, comparisons });
  writeFileSync(resolve(directory, runId + '.json'), JSON.stringify(summary, null, 2) + '\n', {
    flag: 'wx',
  });
  writeFileSync(
    resolve(directory, runId + '.csv'),
    csv(
      results.map((row) => ({
        runId,
        commit: metadata.commit,
        date: metadata.date,
        node: metadata.node,
        machineId: metadata.machine.id,
        cpu: metadata.machine.cpu,
        os: metadata.machine.os,
        methodHash: metadata.methodHash,
        fixtureHash: metadata.fixtureHash,
        chessjsVersion: metadata.chessjsVersion,
        quick: sampling.quick,
        ...row,
        oursOverChessjs: comparisons.find((r) => r.task === row.task)?.oursOverChessjs ?? '',
      })),
    ),
    { flag: 'wx' },
  );
  console.table(comparisons);
  console.log(`Saved ${resolve(directory, runId + '.json')}`);
} finally {
  if (values['keep-raw']) {
    console.log(`Raw samples retained: ${temporary}`);
  } else {
    rmSync(temporary, { recursive: true, force: true });
  }
}
