import { describe, it, expect } from 'vitest';
import * as engineModule from '../index.js';
import {
  START_FEN,
  createGame,
  getPiece,
  toGrid,
  replayMoves,
  legalMovesFrom,
  legalMoves,
  isValidMove,
  applyMove,
  isInCheck,
  getGameStatus,
  GameStatetoFEN,
} from '../index.js';

/** Apply moves that must all be legal; fails the test otherwise. */
function play(state, ...ucis) {
  for (const uci of ucis) {
    const result = applyMove(state, uci);
    expect(result, `${uci}: ${result.error}`).toMatchObject({ ok: true });
    state = result.value;
  }
  return state;
}

/** Deep-freeze an object so any mutation throws in strict mode. */
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze(value[key]);
    }
  }
  return value;
}

// Plain-object copy so tests can look up exports by name (ESLint can't check
// computed lookups on a module namespace).
/** @type {Record<string, unknown>} */
const engine = { ...engineModule };

describe('public API surface', () => {
  it('exports every function in the engine contract', () => {
    const expected = [
      'createGame',
      'getPiece',
      'toGrid',
      'replayMoves',
      'legalMovesFrom',
      'legalMoves',
      'isValidMove',
      'applyMove',
      'isInCheck',
      'getGameStatus',
      'GameStatetoFEN',
      'moveToUCI',
      'UCItoMove',
      'printBoard',
    ];
    for (const name of expected) {
      expect(typeof engine[name], name).toBe('function');
    }
    expect(typeof engine.START_FEN).toBe('string');
  });

  it('does not expose 0x88 internals', () => {
    for (const name of [
      'toIndex',
      'sqIndex',
      'sqName',
      'fromSquare',
      'emptyBoard',
      'isAttacked',
      'boardAfterMove',
    ]) {
      expect(engine[name], name).toBeUndefined();
    }
  });

  it('never mutates its input (frozen state)', () => {
    const state = deepFreeze(createGame());
    expect(() => {
      applyMove(state, 'e2e4');
      legalMoves(state);
      legalMovesFrom(state, { row: 6, col: 4 });
      isValidMove(state, 'e2e4');
      isInCheck(state);
      getGameStatus(state);
      toGrid(state);
      GameStatetoFEN(state);
    }).not.toThrow();
  });
});

describe('createGame', () => {
  it('starts from the standard position', () => {
    expect(GameStatetoFEN(createGame())).toBe(START_FEN);
  });

  it('accepts a custom FEN', () => {
    const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
    expect(GameStatetoFEN(createGame(fen))).toBe(fen);
  });

  it('returns a fresh, unshared object every call', () => {
    const a = createGame();
    const b = createGame();
    expect(a).not.toBe(b);
    expect(a.board).not.toBe(b.board);
    a.board[0] = null;
    expect(getPiece(b, { row: 0, col: 0 })).toEqual({ color: 'b', type: 'r' });
  });
});

const FOOLS_MATE = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
const STALEMATE = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1';

describe('games that start from a finished position', () => {
  it('createGame reports checkmate for a mated FEN', () => {
    expect(createGame(FOOLS_MATE)).toMatchObject({
      status: 'checkmate',
      winner: 'b',
      drawReason: null,
    });
  });

  it('createGame reports stalemate for a stalemated FEN', () => {
    expect(createGame(STALEMATE)).toMatchObject({
      status: 'stalemate',
      winner: null,
      drawReason: 'stalemate',
    });
  });

  it("replayMoves with no moves reports the start position's result", () => {
    expect(replayMoves([], FOOLS_MATE).value.status).toBe('checkmate');
  });

  it('a normal start is still active', () => {
    expect(createGame()).toMatchObject({ status: 'active', winner: null, drawReason: null });
  });
});

describe('getPiece and toGrid', () => {
  const state = createGame();

  it('uses row 0 = rank 8 and col 0 = file a', () => {
    expect(getPiece(state, { row: 0, col: 0 })).toEqual({ color: 'b', type: 'r' }); // a8
    expect(getPiece(state, { row: 7, col: 4 })).toEqual({ color: 'w', type: 'k' }); // e1
    expect(getPiece(state, { row: 4, col: 4 })).toBeNull(); // e4
  });

  it('rejects squares outside the board', () => {
    expect(() => getPiece(state, { row: 8, col: 0 })).toThrow();
    expect(() => getPiece(state, { row: 0, col: -1 })).toThrow();
    expect(() => getPiece(state, null)).toThrow();
  });

  it('returns an 8x8 grid matching getPiece', () => {
    const grid = toGrid(state);
    expect(grid).toHaveLength(8);
    for (let row = 0; row < 8; row++) {
      expect(grid[row]).toHaveLength(8);
      for (let col = 0; col < 8; col++) {
        expect(grid[row][col]).toEqual(getPiece(state, { row, col }));
      }
    }
  });

  it('returns a copy, so editing the grid does not change the state', () => {
    const grid = toGrid(state);
    grid[0][0] = null;
    expect(getPiece(state, { row: 0, col: 0 })).not.toBeNull();
  });

  it('returns copies of pieces, so editing one does not change the state', () => {
    const fresh = createGame();
    toGrid(fresh)[7][4].type = 'q'; // e1 king
    getPiece(fresh, { row: 7, col: 3 }).color = 'b'; // d1 queen
    expect(getPiece(fresh, { row: 7, col: 4 })).toEqual({ color: 'w', type: 'k' });
    expect(getPiece(fresh, { row: 7, col: 3 })).toEqual({ color: 'w', type: 'q' });
    expect(GameStatetoFEN(fresh)).toBe(START_FEN);
  });
});

describe('legalMovesFrom', () => {
  it('returns no moves once the game is over, even if pieces could still move', () => {
    // e.g. a draw (by rule or agreement) leaves movable pieces on the board.
    const drawn = { ...createGame(), status: 'draw', drawReason: 'agreement' };
    expect(legalMovesFrom(drawn, { row: 6, col: 4 })).toEqual([]); // e2
    expect(legalMoves(drawn)).toEqual([]);
    expect(isValidMove(drawn, 'e2e4')).toBe(false);
  });

  it('returns the two pawn pushes from e2 at the start', () => {
    const targets = legalMovesFrom(createGame(), { row: 6, col: 4 });
    expect(targets).toEqual(
      expect.arrayContaining([
        { row: 5, col: 4 }, // e3
        { row: 4, col: 4 }, // e4
      ]),
    );
    expect(targets).toHaveLength(2);
  });
});

describe('legalMoves', () => {
  it('lists all 20 opening moves as UCI', () => {
    const moves = legalMoves(createGame());
    expect(moves).toHaveLength(20);
    expect(moves).toEqual(expect.arrayContaining(['e2e4', 'g1f3', 'b1c3', 'a2a3']));
  });

  it("lists Kiwipete's 48 moves, including both castles", () => {
    const kiwipete = createGame(
      'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    );
    const moves = legalMoves(kiwipete);
    expect(moves).toHaveLength(48);
    expect(moves).toEqual(expect.arrayContaining(['e1g1', 'e1c1']));
  });

  it('lists every promotion piece', () => {
    const moves = legalMoves(createGame('4k3/P7/8/8/8/8/8/4K3 w - - 0 1'));
    expect(moves).toEqual(expect.arrayContaining(['a7a8q', 'a7a8r', 'a7a8b', 'a7a8n']));
    expect(moves).not.toContain('a7a8');
  });

  it('agrees with isValidMove', () => {
    const state = createGame();
    for (const uci of legalMoves(state)) {
      expect(isValidMove(state, uci), uci).toBe(true);
    }
  });

  it('returns no moves once the game is over', () => {
    const mated = play(createGame(), 'f2f3', 'e7e5', 'g2g4', 'd8h4');
    expect(legalMoves(mated)).toEqual([]);
  });
});

describe('isValidMove', () => {
  it('accepts legal moves and rejects everything else without throwing', () => {
    const state = createGame();
    expect(isValidMove(state, 'e2e4')).toBe(true);
    for (const uci of ['e2e5', 'e7e5', 'zz99', '', 'e2e4q']) {
      expect(isValidMove(state, uci), uci).toBe(false);
    }
    expect(isValidMove(state, null)).toBe(false);
  });
});

describe('applyMove and status through the public API', () => {
  it('plays a move and reports the new position', () => {
    const state = play(createGame(), 'e2e4');
    expect(state.currentTurn).toBe('b');
    expect(GameStatetoFEN(state).split(' ').slice(0, 4).join(' ')).toBe(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3',
    );
  });

  it("reports check and checkmate after Fool's Mate", () => {
    const state = play(createGame(), 'f2f3', 'e7e5', 'g2g4', 'd8h4');
    expect(isInCheck(state)).toBe(true);
    expect(getGameStatus(state)).toEqual({ status: 'checkmate', winner: 'b', drawReason: null });
    expect(state.status).toBe('checkmate');
  });
});

describe('replayMoves', () => {
  it('rebuilds the same state as playing the moves one by one', () => {
    const moves = ['e2e4', 'e7e5', 'g1f3', 'b8c6'];
    const result = replayMoves(moves);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual(play(createGame(), ...moves));
  });

  it('returns the starting position for an empty list', () => {
    expect(GameStatetoFEN(replayMoves([]).value)).toBe(START_FEN);
  });

  it('reports which move failed', () => {
    const result = replayMoves(['e2e4', 'e7e5', 'e4e5']);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/^Move 3 \(e4e5\)/);
  });

  it('returns an error instead of throwing on bad input', () => {
    expect(replayMoves('e2e4').ok).toBe(false);
    expect(replayMoves([], 'not a fen').ok).toBe(false);
  });

  it('restores a finished game with its result', () => {
    const result = replayMoves(['f2f3', 'e7e5', 'g2g4', 'd8h4']);
    expect(result.value.status).toBe('checkmate');
    expect(result.value.winner).toBe('b');
  });
});

describe('FEN round-trip', () => {
  it('createGame and GameStatetoFEN round-trip', () => {
    expect(GameStatetoFEN(createGame(START_FEN))).toBe(START_FEN);
  });

  it('does not export the short names or FENtoGameState', () => {
    for (const name of ['toFEN', 'fromFEN', 'FENtoGameState']) {
      expect(engine[name], name).toBeUndefined();
    }
  });
});
