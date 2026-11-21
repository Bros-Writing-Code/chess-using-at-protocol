import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { chessjs } from './adapters/chessjs.js';
import { loadOurs } from './adapters/ours.js';
import { positions, statusCases } from './fixtures/positions.js';
import { perft } from './perft.js';
import { games, workloads } from './workloads.js';

// Compare EP semantics through legal moves, allowing non-capturable FEN spelling.
function fenWithoutEp(fen) {
  const fields = fen.split(' ');
  fields[3] = '-';
  return fields.join(' ');
}
function checkState(adapter, state, reference, expectedFen) {
  assert.equal(fenWithoutEp(adapter.fen(state)), fenWithoutEp(expectedFen), adapter.id);
  assert.deepEqual(adapter.moves(state).sort(), chessjs.moves(reference).sort(), adapter.id);
  assert.deepEqual(adapter.status(state), chessjs.status(reference), adapter.id);
}
function checkPositions(adapters, quick) {
  for (const position of positions) {
    const reference = chessjs.load(position.fen);
    for (const adapter of adapters) {
      const state = adapter.load(position.fen);
      checkState(adapter, state, reference, position.fen);
      if (!quick) {
        assert.equal(
          perft(adapter, state, position.depth),
          position.nodes,
          `${adapter.id} ${position.id}`,
        );
      }
    }
  }
}
function checkReplays(adapters) {
  for (const game of games) {
    const reference = chessjs.replay(game.moves);
    for (const adapter of adapters) {
      checkState(adapter, adapter.replay(game.moves), reference, game.fen);
      if (adapter.pgn) {
        checkState(adapter, adapter.pgn(game.pgn), reference, game.fen);
      }
    }
  }
}
function checkQueries(adapters) {
  for (const adapter of adapters) {
    for (const task of workloads(adapter).filter((t) => t.id.startsWith('isValidMove/'))) {
      assert.equal(task.query(), task.id.endsWith('/legal'), `${adapter.id} ${task.id}`);
    }
  }
  for (const sample of statusCases) {
    const states = adapters.map((adapter) =>
      sample.moves ? adapter.replay(sample.moves) : adapter.load(sample.fen),
    );
    assert.equal(adapters[0].status(states[0]).status, sample.expected);
    assert.deepEqual(adapters[0].status(states[0]), chessjs.status(states[1]));
  }
}
export async function validate({ quick = false } = {}) {
  const ours = await loadOurs();
  const manifest = JSON.parse(
    readFileSync(new URL('./fixtures/manifest.json', import.meta.url), 'utf8'),
  );
  assert.equal(
    createHash('sha256')
      .update(readFileSync(new URL('./fixtures/games.json', import.meta.url)))
      .digest('hex'),
    manifest.sha256,
  );
  assert.equal(games.length, 200);
  const adapters = [ours, chessjs];
  checkPositions(adapters, quick);
  checkReplays(adapters);
  checkQueries(adapters);
  return {
    games: games.length,
    fixtureHash: manifest.sha256,
    pgn: ours.pgn ? 'supported' : 'unsupported: replayPGN is not exported',
  };
}
