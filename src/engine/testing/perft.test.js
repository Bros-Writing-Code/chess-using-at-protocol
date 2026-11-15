import { describe, it, expect } from 'vitest';
import { SQUARES, toSquare } from '../0x88helper.js';
import { moveGenerator } from '../moveGeneration.js';
import { applyMove } from '../gameState.js';
import { FENtoGameState, moveToUCI } from '../notation.js';

/**
 * Perft ("performance test") counts every legal move sequence to a given
 * depth and compares the total with published values. Any bug in move
 * generation or move application (castling, en passant, promotion, pins,
 * checks) changes the count.
 *
 * Moves go through the real applyMove, so this also tests it end to end.
 * Reference values: https://www.chessprogramming.org/Perft_Results
 */

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const KIWIPETE = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';

/** Every legal move for the side to move, as UCI strings. */
function legalUCIMoves(state) {
  const moves = [];
  for (const index of SQUARES) {
    const piece = state.board[index];
    if (!piece || piece.color !== state.currentTurn) continue;

    const from = toSquare(index);
    const lastRow = piece.color === 'w' ? 0 : 7;
    for (const to of moveGenerator(state, from)) {
      const uci = moveToUCI({ from, to });
      if (piece.type === 'p' && to.row === lastRow) {
        for (const promotion of ['q', 'r', 'b', 'n']) moves.push(uci + promotion);
      } else {
        moves.push(uci);
      }
    }
  }
  return moves;
}

/** Number of leaf positions reachable in exactly `depth` moves. */
function perft(state, depth) {
  if (depth === 0) return 1;
  let nodes = 0;
  for (const uci of legalUCIMoves(state)) {
    const result = applyMove(state, uci);
    if (!result.ok) throw new Error(`applyMove rejected generated move ${uci}: ${result.error}`);
    nodes += perft(result.value, depth - 1);
  }
  return nodes;
}

/**
 * Per-move breakdown ("divide"): how many leaf positions follow each first
 * move. Not used by the assertions; call it while debugging a mismatch and
 * compare with another engine's divide output to find the wrong move.
 */
export function divide(fen, depth) {
  const state = FENtoGameState(fen);
  const counts = {};
  for (const uci of legalUCIMoves(state)) {
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
    expect(perft(FENtoGameState(START), depth)).toBe(expected);
  });

  it.each([
    [1, 48],
    [2, 2_039],
  ])('Kiwipete, depth %i = %i', (depth, expected) => {
    expect(perft(FENtoGameState(KIWIPETE), depth)).toBe(expected);
  });

  it('divide sums to the perft total', () => {
    const counts = divide(KIWIPETE, 2);
    expect(Object.keys(counts)).toHaveLength(48);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(2_039);
  });
});
