import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { settings } from '../settings.js';

const directories = [];
afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});
function temporary() {
  const path = mkdtempSync(resolve(tmpdir(), 'benchmark-cli-test-'));
  directories.push(path);
  return path;
}
function sample(runId = 'sample') {
  return {
    schemaVersion: 1,
    runId,
    metadata: {
      commit: 'a'.repeat(40),
      date: '2026-11-20T00:00:00Z',
      method: 'test',
      methodHash: 'method',
      fixtureHash: 'fixture',
      node: process.version,
      vitestVersion: '2.1.9',
      machine: { id: 'test', os: 'test', cpu: 'test CPU' },
      settings: { ...settings(true), tasks: 'all' },
      label: '<script>long label & quotes</script>',
    },
    results: ['ours', 'chessjs'].map((engine) => ({
      engine,
      task: 'applyMove/history0',
      unit: 'move',
      workUnits: 1,
      batchSize: 1,
      rounds: 1,
      sampleCount: 10,
      medianMs: 2,
      meanMs: 2,
      opsPerSecond: 500,
      roundMinMs: 1,
      roundMaxMs: 3,
    })),
  };
}
function save(directory, run) {
  writeFileSync(resolve(directory, run.runId + '.json'), JSON.stringify(run));
}
function command(script, ...args) {
  return spawnSync(
    process.execPath,
    [resolve('benchmarks/engine/scripts/' + script + '.js'), ...args],
    { encoding: 'utf8' },
  );
}
it('charts shared tasks across filters and preserves reference-only capabilities', () => {
  const input = temporary(),
    output = temporary();
  const ours = sample('ours');
  ours.results = ours.results.filter((row) => row.engine === 'ours');
  const reference = sample('reference');
  reference.metadata.settings.tasks = 'applyMove';
  reference.results = reference.results.filter((row) => row.engine === 'chessjs');
  save(input, ours);
  save(input, reference);
  const result = command('charts', '--all', '--input', input, '--output', output);
  expect(result.status, result.stderr).toBe(0);
  const groups = readdirSync(output);
  expect(groups).toHaveLength(1);
  const files = readdirSync(resolve(output, groups[0]));
  expect(files.filter((file) => file.endsWith('.svg'))).toEqual(['applyMove.svg']);
  const bars = readFileSync(resolve(output, groups[0], 'applyMove.svg'), 'utf8');
  expect(bars).toContain('&lt;script&gt;');
  expect(bars).not.toContain('<script>');
  const selected = command(
    'charts',
    '--runs',
    'reference',
    '--input',
    input,
    '--output',
    temporary(),
  );
  expect(selected.status, selected.stderr).toBe(0);
});
it('groups scenarios into eight charts and uses only labels for run names', () => {
  const input = temporary(),
    output = temporary();
  const run = sample('all');
  run.metadata.label = 'engine-v1';
  const tasks = [
    'perft/start/d4',
    'applyMove/history0',
    'applyMove/history60',
    'legalMoves/start',
    'isValidMove/history0/legal',
    'getGameStatus/active',
    'replay/200-games',
    'fen/load/start',
    'fen/save/start',
    'pgn/replay/200-games',
  ];
  run.results = tasks.flatMap((task) => run.results.map((row) => ({ ...row, task })));
  save(input, run);
  const result = command('charts', '--all', '--input', input, '--output', output);
  expect(result.status, result.stderr).toBe(0);
  const directory = resolve(output, readdirSync(output)[0]);
  expect(readdirSync(directory).filter((file) => file.endsWith('.svg'))).toHaveLength(8);
  const moves = readFileSync(resolve(directory, 'applyMove.svg'), 'utf8');
  expect(moves).toContain('applyMove/history0');
  expect(moves).toContain('applyMove/history60');
  expect(moves).toContain('engine-v1');
  expect(moves).not.toContain(run.metadata.commit.slice(0, 7));
  expect(moves).not.toContain(run.metadata.date.slice(0, 19));
  run.metadata.label = '  ';
  save(input, run);
  const filteredOutput = temporary();
  expect(
    command('charts', '--all', '--tasks', 'fen/save', '--input', input, '--output', filteredOutput)
      .status,
  ).toBe(0);
  const filtered = resolve(filteredOutput, readdirSync(filteredOutput)[0]);
  expect(readdirSync(filtered).filter((file) => file.endsWith('.svg'))).toEqual(['fen.svg']);
  expect(readFileSync(resolve(filtered, 'fen.svg'), 'utf8')).toContain('Unlabeled');
  expect(readFileSync(resolve(filtered, 'fen.svg'), 'utf8')).not.toContain('fen/load');
});
it('rejects ambiguous selection, unknown IDs/prefixes, and corrupt summaries', () => {
  const input = temporary();
  save(input, sample());
  for (const args of [
    [],
    ['--all', '--runs', 'sample'],
    ['--runs', 'missing'],
    ['--all', '--tasks', 'typo'],
    ['--all', '--tasks', 'applyMove,'],
  ]) {
    expect(command('charts', ...args, '--input', input, '--output', temporary()).status).not.toBe(
      0,
    );
  }
  const broken = sample('broken');
  broken.results[0].medianMs = 0;
  save(input, broken);
  const result = command('charts', '--all', '--input', input, '--output', temporary());
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('broken.json');
});
it('compares saved results and rejects changed runner versions or no shared tasks', () => {
  const input = temporary();
  const before = sample('before'),
    after = sample('after');
  save(input, before);
  save(input, after);
  const args = ['--before', resolve(input, 'before.json'), '--after', resolve(input, 'after.json')];
  expect(command('compare', ...args).status).toBe(0);
  after.metadata.vitestVersion = 'different';
  save(input, after);
  expect(command('compare', ...args).stderr).toContain('Incompatible');
  after.metadata.vitestVersion = before.metadata.vitestVersion;
  after.results = after.results.map((row) => ({ ...row, task: 'other' }));
  save(input, after);
  expect(command('compare', ...args).stderr).toContain('No shared tasks');
});
