import { describe, it, expect } from 'vitest';
import { createGame, legalMoves, applyMove } from '../index.js';

/**
 * Perft ("performance test") counts every legal move sequence to a given
 * depth and compares the total with published values. Any bug in move
 * generation or move application (castling, en passant, promotion, pins,
 * checks) changes the count.
 *
 * Moves come from the public legalMoves and go through the real applyMove,
 * so this also tests the public API end to end.
 * Reference values: https://www.chessprogramming.org/Perft_Results
 *
 * Note: legalMoves returns [] once a game is over (checkmate, stalemate or a
 * draw rule). Standard perft ignores draw rules, but none can trigger at the
 * depths below. Deeper perft would need an internal path that skips them.
 */

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const KIWIPETE = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';

/** Throws unless depth is a whole number of at least `min`. */
function checkDepth(depth, min) {
  if (!Number.isInteger(depth) || depth < min) {
    throw new RangeError(`depth must be an integer >= ${min}, got ${depth}`);
  }
}

/** Number of leaf positions reachable in exactly `depth` moves. */
function perft(state, depth) {
  if (depth === 0) {return 1;}
  let nodes = 0;
  for (const uci of legalMoves(state)) {
    const result = applyMove(state, uci);
    if (!result.ok) {throw new Error(`applyMove rejected generated move ${uci}: ${result.error}`);}
    nodes += perft(result.value, depth - 1);
  }
  return nodes;
}

/**
 * Per-move breakdown ("divide"): how many leaf positions follow each first
 * move. Not used by the assertions; call it while debugging a mismatch and
 * compare with another engine's divide output to find the wrong move.
 *
 * @param {string} fen
 * @param {number} depth - At least 1.
 */
export function divide(fen, depth) {
  checkDepth(depth, 1);
  const state = createGame(fen);
  const counts = {};
  for (const uci of legalMoves(state)) {
    counts[uci] = perft(applyMove(state, uci).value, depth - 1);
  }
  return counts;
}

describe('perft', () => {
  it.each([
    [1, 20],
    [2, 400],
    [3, 8_902],
  ])('start position, depth %i = %i', (depth, expected) => {
    expect(perft(createGame(START), depth)).toBe(expected);
  });

  it.each([
    [1, 48],
    [2, 2_039],
  ])('Kiwipete, depth %i = %i', (depth, expected) => {
    expect(perft(createGame(KIWIPETE), depth)).toBe(expected);
  });

  it('divide sums to the perft total', () => {
    const counts = divide(KIWIPETE, 2);
    expect(Object.keys(counts)).toHaveLength(48);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(2_039);
  });

  it('divide rejects a depth below 1 instead of recursing forever', () => {
    for (const depth of [0, -1, 1.5, Number.NaN]) {
      expect(() => divide(START, depth)).toThrow(RangeError);
    }
  });
});
