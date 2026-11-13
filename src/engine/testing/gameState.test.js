import { describe, expect, it } from 'vitest';
import { applyMove, getGameStatus, isInCheck } from '../gameState.js';
import { FENtoGameState, GameStatetoFEN } from '../notation.js';
import { sqIndex } from '../0x88helper.js';

describe('isInCheck', () => {
  it('returns false in the starting position', () => {
    const state = FENtoGameState(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    );

    expect(isInCheck(state)).toBe(false);
  });

  it('detects a direct attack on the side to move', () => {
    const state = FENtoGameState('4r1k1/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(isInCheck(state)).toBe(true);

    state.currentTurn = 'b';
    expect(isInCheck(state)).toBe(false);
  });

  it('detects a discovered attack after a blocking piece moves away', () => {
    const blocked = FENtoGameState('4r1k1/8/8/4b3/8/8/8/4K3 w - - 0 1');
    const exposed = FENtoGameState('4r1k1/8/8/8/5b2/8/8/4K3 w - - 0 1');

    expect(isInCheck(blocked)).toBe(false);
    expect(isInCheck(exposed)).toBe(true);
  });
});

describe('getGameStatus', () => {
  it('returns active for the starting position', () => {
    const state = FENtoGameState(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    );

    expect(getGameStatus(state)).toEqual({
      status: 'active', winner: null, drawReason: null,
    });
  });

  it('detects Fool’s Mate and names Black as the winner', () => {
    const state = FENtoGameState(
      'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'
    );

    expect(getGameStatus(state)).toEqual({
      status: 'checkmate', winner: 'b', drawReason: null,
    });
  });

  it('detects checkmate when White wins', () => {
    const state = FENtoGameState('7k/6Q1/5K2/8/8/8/8/8 b - - 0 1');

    expect(getGameStatus(state)).toEqual({
      status: 'checkmate', winner: 'w', drawReason: null,
    });
  });

  it('detects stalemate', () => {
    const state = FENtoGameState('k7/8/1QK5/8/8/8/8/8 b - - 0 1');

    expect(getGameStatus(state)).toEqual({
      status: 'stalemate', winner: null, drawReason: 'stalemate',
    });
  });

  it('keeps the game active when the checked king can escape', () => {
    const state = FENtoGameState('4r1k1/8/8/8/8/8/8/4K3 w - - 0 1');

    expect(getGameStatus(state)).toEqual({
      status: 'active', winner: null, drawReason: null,
    });
  });
});

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function play(state, uci) {
  const result = applyMove(state, uci);
  expect(result).toMatchObject({ ok: true });
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe('applyMove', () => {
  it('parses a legal move, advances turn and clocks, records history, and leaves input untouched', () => {
    const initial = FENtoGameState(START);
    const snapshot = structuredClone(initial);
    const afterWhite = play(initial, 'e2e4');

    expect(initial).toEqual(snapshot);
    expect(afterWhite).not.toBe(initial);
    expect(afterWhite.board).not.toBe(initial.board);
    expect(afterWhite.castlingRights).not.toBe(initial.castlingRights);
    expect(GameStatetoFEN(afterWhite)).toBe(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    );
    expect(afterWhite.moveHistory).toEqual([{ from: { row: 6, col: 4 }, to: { row: 4, col: 4 } }]);
    expect(afterWhite.positionHistory).toEqual([
      START.split(' ').slice(0, 4).join(' '),
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -',
    ]);
    expect(afterWhite.status).toBe('active');

    const afterBlack = play(afterWhite, 'c7c5');
    expect(afterBlack.fullmoveNumber).toBe(2);
    expect(afterBlack.halfmoveClock).toBe(0);
    expect(afterBlack.enPassantTarget).toBe(sqIndex('c6'));
    expect(afterBlack.moveHistory).toHaveLength(2);
    expect(afterBlack.positionHistory).toHaveLength(3);
  });

  it('rejects malformed, out-of-turn, impossible, and incorrectly suffixed moves', () => {
    const state = FENtoGameState(START);
    for (const uci of ['bad', 'e2e9', 'e2e4x', 'e7e5', 'e2e5', 'e2e4q']) {
      expect(applyMove(state, uci).ok).toBe(false);
    }
    expect(GameStatetoFEN(state)).toBe(START);
    expect(state.moveHistory).toEqual([]);
  });

  it('returns a Result error for an invalid state instead of throwing', () => {
    const missingKing = FENtoGameState('8/8/8/8/8/8/4P3/4K3 w - - 0 1');
    expect(applyMove(missingKing, 'e2e4')).toEqual({ ok: false, error: 'Invalid game state' });
    expect(applyMove(null, 'e2e4')).toEqual({ ok: false, error: 'Invalid game state' });
  });

  it('does not share piece objects between old and new boards', () => {
    const state = FENtoGameState(START);
    const next = play(state, 'e2e4');
    expect(next.board[sqIndex('a1')]).not.toBe(state.board[sqIndex('a1')]);
    expect(next.board[sqIndex('e4')]).not.toBe(state.board[sqIndex('e2')]);
    next.board[sqIndex('a1')].type = 'q';
    expect(state.board[sqIndex('a1')].type).toBe('r');
  });

  it('does not share earlier move records with the previous state', () => {
    const first = play(FENtoGameState(START), 'e2e4');
    const second = play(first, 'e7e5');
    expect(second.moveHistory[0]).not.toBe(first.moveHistory[0]);
    expect(second.moveHistory[0].from).not.toBe(first.moveHistory[0].from);
    second.moveHistory[0].from.col = 0;
    expect(first.moveHistory[0].from.col).toBe(4);
  });

  it('updates quiet-move and capture clocks, including rook rights on capture', () => {
    const state = FENtoGameState('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 4 7');
    const after = play(state, 'a1a8');
    expect(GameStatetoFEN(after)).toBe('R3k2r/8/8/8/8/8/8/4K2R b Kk - 0 7');
    expect(state.castlingRights.wQueenside).toBe(true);
    const quiet = play(FENtoGameState('4k3/8/8/8/8/8/8/4K2R w K - 4 7'), 'h1h2');
    expect(quiet.halfmoveClock).toBe(5);
    expect(quiet.castlingRights.wKingside).toBe(false);
  });

  it('moves the rook when castling on either side and clears king rights', () => {
    const white = play(FENtoGameState('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'e1g1');
    expect(GameStatetoFEN(white)).toBe('r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1');
    const black = play(FENtoGameState('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1'), 'e8c8');
    expect(GameStatetoFEN(black)).toBe('2kr3r/8/8/8/8/8/8/R3K2R w KQ - 1 2');
    expect(applyMove(FENtoGameState('4kr1r/8/8/8/8/8/8/4K3 b k - 0 1'), 'e8g8').ok).toBe(false);
  });

  it('captures en passant and expires the target after a different move', () => {
    const state = FENtoGameState('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2');
    const capture = play(state, 'e5d6');
    expect(GameStatetoFEN(capture)).toBe('4k3/8/3P4/8/8/8/8/4K3 b - - 0 2');
    expect(capture.board[sqIndex('d5')]).toBeNull();
    expect(state.board[sqIndex('d5')]).toEqual({ color: 'b', type: 'p' });
    expect(play(state, 'e1e2').enPassantTarget).toBeNull();
  });

  it('records en passant in the repetition key only when the capture is legal', () => {
    const legal = play(FENtoGameState('k7/3p4/8/4P3/8/8/8/4K3 b - - 0 1'), 'd7d5');
    expect(legal.positionHistory.at(-1)).toBe('k7/8/8/3pP3/8/8/8/4K3 w - d6');

    const pinned = play(FENtoGameState('k3r3/3p4/8/4P3/8/8/8/4K3 b - - 0 1'), 'd7d5');
    expect(GameStatetoFEN(pinned).split(' ')[3]).toBe('d6');
    expect(pinned.positionHistory.at(-1)).toBe('k3r3/8/8/3pP3/8/8/8/4K3 w - -');
    expect(applyMove(pinned, 'e5d6').ok).toBe(false);
  });

  it.each(['q', 'r', 'b', 'n'])('requires and records promotion to %s', (kind) => {
    const state = FENtoGameState('7k/P7/8/8/8/8/8/4K3 w - - 0 1');
    expect(applyMove(state, 'a7a8').ok).toBe(false);
    const next = play(state, `a7a8${kind}`);
    expect(next.board[sqIndex('a8')]).toEqual({ color: 'w', type: kind });
    expect(next.moveHistory[0].promotion).toBe(kind);
    expect(next.halfmoveClock).toBe(0);
  });

  it('fills in checkmate status and rejects moves after the game ends', () => {
    let state = FENtoGameState(START);
    for (const uci of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) state = play(state, uci);
    expect(state).toMatchObject({ status: 'checkmate', winner: 'b', drawReason: null });
    expect(applyMove(state, 'e2e4').ok).toBe(false);
  });
});
