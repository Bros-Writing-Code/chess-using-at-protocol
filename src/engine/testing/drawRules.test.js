import { describe, it, expect } from 'vitest';
import { applyMove, getGameStatus, isInsufficientMaterial } from '../gameState.js';
import { FENtoGameState } from '../notation.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const ACTIVE = { status: 'active', winner: null, drawReason: null };
const draw = (drawReason) => ({ status: 'draw', winner: null, drawReason });

/** Apply moves that must all be legal; fails the test otherwise. */
function play(state, ...ucis) {
  for (const uci of ucis) {
    const result = applyMove(state, uci);
    expect(result, `${uci}: ${result.error}`).toMatchObject({ ok: true });
    state = result.value;
  }
  return state;
}

const status = (fen) => getGameStatus(FENtoGameState(fen));

describe('insufficient material', () => {
  it.each([
    ['K vs K', '4k3/8/8/8/8/8/8/4K3 w - - 0 1'],
    ['K+B vs K', '4k3/8/8/8/8/8/8/2B1K3 w - - 0 1'],
    ['K+N vs K', '4k3/8/8/8/8/8/8/1N2K3 b - - 0 1'],
    ['K+B vs K+B, same square color', '2b1k3/8/8/8/8/8/8/3BK3 w - - 0 1'],
  ])('%s is a draw', (_, fen) => {
    expect(status(fen)).toEqual(draw('insufficient-material'));
  });

  it.each([
    ['K+B vs K+B, opposite square colors', '3bk3/8/8/8/8/8/8/3BK3 w - - 0 1'],
    ['K+N+N vs K', '4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1'],
    ['K+B+N vs K', '4k3/8/8/8/8/8/8/1N1BK3 w - - 0 1'],
    ['K+N vs K+N', '1n2k3/8/8/8/8/8/8/1N2K3 w - - 0 1'],
    ['K+P vs K', '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'],
    ['K+R vs K', '4k3/8/8/8/8/8/8/R3K3 w - - 0 1'],
    ['K+Q vs K', '4k3/8/8/8/8/8/8/3QK3 w - - 0 1'],
  ])('%s is not a draw', (_, fen) => {
    expect(isInsufficientMaterial(FENtoGameState(fen))).toBe(false);
    expect(status(fen)).toEqual(ACTIVE);
  });

  it('is detected right after a capture leaves bare kings', () => {
    const state = play(FENtoGameState('4k3/8/8/8/8/8/4q3/4K3 w - - 0 1'), 'e1e2');
    expect(state.status).toBe('draw');
    expect(state.drawReason).toBe('insufficient-material');
  });
});

describe('fifty-move rule', () => {
  const ROOKS = '4k3/r7/8/8/8/8/R7/4K3';

  it('draws at 100 halfmoves without a pawn move or capture', () => {
    expect(status(`${ROOKS} w - - 100 80`)).toEqual(draw('fifty-move-rule'));
  });

  it('is still active at 99 halfmoves', () => {
    expect(status(`${ROOKS} w - - 99 80`)).toEqual(ACTIVE);
  });

  it('triggers when a quiet move reaches 100 halfmoves', () => {
    const state = play(FENtoGameState(`${ROOKS} w - - 99 80`), 'a2b2');
    expect(state.halfmoveClock).toBe(100);
    expect(state.drawReason).toBe('fifty-move-rule');
  });

  it('gives priority to checkmate on the 100th halfmove', () => {
    const state = play(FENtoGameState('6k1/5ppp/8/8/8/8/8/R5K1 w - - 99 80'), 'a1a8');
    expect(state.halfmoveClock).toBe(100);
    expect(state.status).toBe('checkmate');
    expect(state.winner).toBe('w');
  });
});

describe('threefold repetition', () => {
  const SHUFFLE = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];

  it('is not a draw after the position occurs twice', () => {
    const state = play(FENtoGameState(START), ...SHUFFLE);
    expect(state.status).toBe('active');
  });

  it('draws when the position occurs a third time', () => {
    const state = play(FENtoGameState(START), ...SHUFFLE, ...SHUFFLE);
    expect(state.status).toBe('draw');
    expect(state.drawReason).toBe('threefold-repetition');
  });

  it('does not count positions before a pawn move', () => {
    // Shuffle, push a pawn each, then shuffle back: the start position cannot recur.
    const state = play(FENtoGameState(START), ...SHUFFLE, 'a2a3', 'a7a6', ...SHUFFLE);
    expect(state.status).toBe('active');
  });

  it('counts positions with different castling rights as different', () => {
    // Kings step out and back: same placement, but castling rights are gone.
    const state = play(
      FENtoGameState('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'),
      'e1f1',
      'e8f8',
      'f1e1',
      'f8e8',
      'e1f1',
      'e8f8',
      'f1e1',
      'f8e8',
    );
    // Position after the 4th move (no rights) occurs only twice by the 8th move.
    expect(state.status).toBe('active');
  });

  it('ignores a FEN with no history', () => {
    expect(status(START)).toEqual(ACTIVE);
  });
});

describe('after a draw', () => {
  it('rejects further moves', () => {
    const state = play(
      FENtoGameState(START),
      'g1f3',
      'g8f6',
      'f3g1',
      'f6g8',
      'g1f3',
      'g8f6',
      'f3g1',
      'f6g8',
    );
    expect(applyMove(state, 'e2e4')).toMatchObject({ ok: false });
  });
});
