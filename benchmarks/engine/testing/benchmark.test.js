import { describe, expect, it } from 'vitest';
import { chessjs } from '../adapters/chessjs.js';
import { loadOurs } from '../adapters/ours.js';
import { positions } from '../fixtures/positions.js';
import { perft } from '../perft.js';
import {
  compareRuns,
  compatibility,
  csv,
  extract,
  median,
  ratios,
  summarize,
  validateRun,
} from '../scripts/results.js';
import { selectTasks, settings, taskPrefixes } from '../settings.js';
import { workloads } from '../workloads.js';

describe('benchmark contract', () => {
  it('counts identical public API trees and restores the mutable state', async () => {
    for (const adapter of [await loadOurs(), chessjs]) {
      const state = adapter.load(positions[0].fen);
      expect(perft(adapter, state, 2)).toBe(400);
      expect(adapter.fen(state)).toBe(positions[0].fen);
    }
  });
  it('single-move cleanup repeatedly restores precisely the same input', async () => {
    for (const adapter of [await loadOurs(), chessjs]) {
      for (const task of workloads(adapter).filter((t) => t.id.startsWith('applyMove'))) {
        const results = [];
        for (let i = 0; i < 4; i++) {
          results.push(adapter.fen(task.run()));
          task.afterEach?.();
        }
        expect(new Set(results).size).toBe(1);
      }
    }
  });
  it('summarizes round medians and weighted means without retaining samples', () => {
    const row = (median, mean, sampleCount) => ({ name: 'ours::move', median, mean, sampleCount });
    const raw = { files: [{ groups: [{ benchmarks: [row(2, 3, 10)] }] }] };
    expect(extract(raw)).toEqual([row(2, 3, 10)]);
    const [result] = summarize(
      [[row(2, 3, 10)], [row(6, 7, 20)]],
      [{ engine: 'ours', task: 'move', unit: 'move', workUnits: 1 }],
    );
    expect(result.medianMs).toBe(4);
    expect(result.meanMs).toBeCloseTo(170 / 30);
    expect(result.opsPerSecond).toBe(250);
    expect(result.sampleCount).toBe(30);
    expect(result.samples).toBeUndefined();
    expect(
      summarize(
        [[row(128, 256, 2)]],
        [{ engine: 'ours', task: 'move', unit: 'query', workUnits: 1, batchSize: 128 }],
      )[0],
    ).toMatchObject({ medianMs: 1, meanMs: 2, opsPerSecond: 1000, sampleCount: 2, batchSize: 128 });
    expect(ratios([result, { ...result, engine: 'chessjs', medianMs: 2 }])[0].oursOverChessjs).toBe(
      2,
    );
    expect(() => summarize([[row(1, 1, 1)], []], [])).toThrow('task sets');
  });
  it('rejects empty measurements and distinguishes incompatible environments', () => {
    expect(() => median([])).toThrow();
    expect(median([3, 1, 2])).toBe(2);
    expect(() => extract({})).toThrow();
    const metadata = {
      methodHash: 'a',
      fixtureHash: 'b',
      node: '24',
      machine: { id: 'one', os: 'os' },
      settings: {},
    };
    expect(compatibility({ metadata })).not.toBe(
      compatibility({ metadata: { ...metadata, node: '20' } }),
    );
    expect(csv([{ task: 'a,"b' }])).toContain('"a,""b"');
  });
  it('rejects malformed, duplicate, missing, and non-finite measurements', () => {
    const row = { name: 'ours::move', median: 1, mean: 1, sampleCount: 2 };
    const descriptor = { engine: 'ours', task: 'move', unit: 'move', workUnits: 1 };
    expect(extract({ benchmarks: [{ ...row, samples: [1, 1] }] })[0].samples).toBeUndefined();
    for (const patch of [{ median: Infinity }, { mean: NaN }, { sampleCount: 0 }]) {
      expect(() => extract({ benchmarks: [{ ...row, ...patch }] })).toThrow('Invalid');
    }
    expect(() => extract({ benchmarks: [row, row] })).toThrow('Duplicate');
    expect(() => summarize([], [descriptor])).toThrow('nonempty');
    expect(() => summarize([[row]], [descriptor, { ...descriptor, engine: 'chessjs' }])).toThrow(
      'task sets',
    );
  });
  it('validates CLI settings and every task prefix', () => {
    for (const value of ['0', '-1', '1.5', 'NaN', '101', '']) {
      expect(() => settings(false, value)).toThrow('--rounds');
    }
    expect(settings(true).rounds).toBe(1);
    expect(taskPrefixes([' replay,applyMove ', 'replay'])).toEqual(['applyMove', 'replay']);
    expect(() => taskPrefixes('replay,')).toThrow('empty');
    expect(() => selectTasks([{ id: 'replay' }], ['replay', 'typo'])).toThrow('typo');
  });
  it('compares shared tasks across filters but rejects environment drift', () => {
    const descriptor = { engine: 'ours', task: 'move', unit: 'move', workUnits: 1 };
    const results = summarize(
      [[{ name: 'ours::move', median: 1, mean: 1, sampleCount: 2 }]],
      [descriptor],
    );
    const run = {
      schemaVersion: 1,
      runId: 'test',
      metadata: {
        commit: 'abc',
        date: '2026-11-20T00:00:00Z',
        methodHash: 'method',
        fixtureHash: 'fixture',
        node: '24',
        machine: { id: 'one', os: 'os' },
        settings: { ...settings(true), tasks: 'all' },
      },
      results,
    };
    expect(validateRun(run)).toBe(run);
    const after = structuredClone(run);
    after.metadata.settings.tasks = 'move';
    expect(compareRuns(run, after)[0].speedup).toBe(1);
    after.metadata.vitestVersion = 'other';
    expect(() => compareRuns(run, after)).toThrow('Incompatible');
    expect(() => validateRun({ ...run, results: [{ ...results[0], medianMs: null }] })).toThrow(
      'task',
    );
    expect(() => validateRun({ ...run, results: [results[0], results[0]] })).toThrow('Duplicate');
  });
  it('reference validity rejects malformed strings without generating moves', () => {
    const state = {
      moves() {
        throw new Error('Unexpected search');
      },
    };
    for (const candidate of [null, undefined, '', 'a9a1', 'e2e4x']) {
      expect(chessjs.valid(state, candidate)).toBe(false);
    }
  });
});
