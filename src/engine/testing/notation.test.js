import { describe, it, expect } from 'vitest';
import { sqIndex, emptyBoard, withPiece } from '../0x88helper.js';
import {
  moveToUCI,
  UCItoMove,
  GameStatetoFEN,
  FENtoGameState,
} from '../notation.js';

const W = (type) => ({ type, color: 'w' });
const B = (type) => ({ type, color: 'b' });

const START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const createMockState = (board = emptyBoard()) => ({
  board,
  currentTurn: 'w',
  castlingRights: {
    wKingside: false,
    wQueenside: false,
    bKingside: false,
    bQueenside: false,
  },
  enPassantTarget: null,
  halfmoveClock: 0,
  fullmoveNumber: 1,
  moveHistory: [],
  positionHistory: [],
  status: 'active',
  winner: null,
  drawReason: null,
});

describe('UCI notation', () => {
  it('converts ordinary moves into UCI', () => {
    expect(moveToUCI({
      from: { row: 6, col: 4 },
      to: { row: 4, col: 4 },
    })).toBe('e2e4');

    expect(moveToUCI({
      from: { row: 7, col: 6 },
      to: { row: 5, col: 5 },
    })).toBe('g1f3');
  });

  it('converts castling moves into UCI', () => {
    expect(moveToUCI({
      from: { row: 7, col: 4 },
      to: { row: 7, col: 6 },
    })).toBe('e1g1');

    expect(moveToUCI({
      from: { row: 0, col: 4 },
      to: { row: 0, col: 2 },
    })).toBe('e8c8');
  });

  it('converts all four promotion types into UCI', () => {
    for (const promotion of ['q', 'r', 'b', 'n']) {
      expect(moveToUCI({
        from: { row: 1, col: 4 },
        to: { row: 0, col: 4 },
        promotion,
      })).toBe(`e7e8${promotion}`);
    }
  });

  it('parses ordinary UCI moves', () => {
    expect(UCItoMove('e2e4')).toEqual({
      from: { row: 6, col: 4 },
      to: { row: 4, col: 4 },
    });

    expect(UCItoMove('g1f3')).toEqual({
      from: { row: 7, col: 6 },
      to: { row: 5, col: 5 },
    });
  });

  it('parses promotion moves', () => {
    for (const promotion of ['q', 'r', 'b', 'n']) {
      expect(UCItoMove(`e7e8${promotion}`)).toEqual({
        from: { row: 1, col: 4 },
        to: { row: 0, col: 4 },
        promotion,
      });
    }
  });

  it('round-trips UCI moves', () => {
    const moves = [
      'e2e4',
      'g1f3',
      'e1g1',
      'e8c8',
      'a7a8q',
      'h2h1n',
      'e5d6',
    ];

    for (const uci of moves) {
      expect(moveToUCI(UCItoMove(uci))).toBe(uci);
    }
  });

  it('rejects invalid UCI strings', () => {
    const invalid = [
      '',
      'e2',
      'e2e',
      'e2e4e5',
      'i2e4',
      'e9e4',
      'e2i4',
      'E2E4',
      'e7e8k',
      'e7e8p',
      'e2-e4',
      ' e2e4',
    ];

    for (const uci of invalid) {
      expect(() => UCItoMove(uci)).toThrow();
    }

    expect(() => UCItoMove(null)).toThrow();
    expect(() => UCItoMove(1234)).toThrow();
  });

  it('rejects invalid Move coordinates', () => {
    const invalidSquares = [
      { row: -1, col: 4 },
      { row: 8, col: 4 },
      { row: 4, col: -1 },
      { row: 4, col: 8 },
      { row: 1.5, col: 4 },
      { row: 4, col: NaN },
    ];

    for (const from of invalidSquares) {
      expect(() => moveToUCI({
        from,
        to: { row: 4, col: 4 },
      })).toThrow();
    }
  });

  it('rejects invalid promotion pieces', () => {
    for (const promotion of ['k', 'p', 'Q', 'x']) {
      expect(() => moveToUCI({
        from: { row: 1, col: 4 },
        to: { row: 0, col: 4 },
        promotion,
      })).toThrow();
    }
  });
});

describe('FEN serialization', () => {
  it('serializes an empty board', () => {
    const state = createMockState();

    expect(GameStatetoFEN(state)).toBe(
      '8/8/8/8/8/8/8/8 w - - 0 1'
    );
  });

  it('serializes pieces using the correct rank orientation', () => {
    let board = emptyBoard();
    board = withPiece(board, sqIndex('e8'), B('k'));
    board = withPiece(board, sqIndex('e1'), W('k'));
    board = withPiece(board, sqIndex('a1'), W('r'));

    const state = createMockState(board);

    expect(GameStatetoFEN(state)).toBe(
      '4k3/8/8/8/8/8/8/R3K3 w - - 0 1'
    );
  });

  it('serializes castling rights in KQkq order', () => {
    const state = createMockState();

    state.castlingRights = {
      wKingside: true,
      wQueenside: true,
      bKingside: true,
      bQueenside: true,
    };

    expect(GameStatetoFEN(state)).toBe(
      '8/8/8/8/8/8/8/8 w KQkq - 0 1'
    );

    state.castlingRights.wQueenside = false;
    state.castlingRights.bKingside = false;

    expect(GameStatetoFEN(state)).toBe(
      '8/8/8/8/8/8/8/8 w Kq - 0 1'
    );
  });

  it('serializes en passant targets as algebraic squares', () => {
    const state = createMockState();

    state.currentTurn = 'b';
    state.enPassantTarget = sqIndex('e3');

    expect(GameStatetoFEN(state)).toBe(
      '8/8/8/8/8/8/8/8 b - e3 0 1'
    );

    state.currentTurn = 'w';
    state.enPassantTarget = sqIndex('d6');

    expect(GameStatetoFEN(state)).toBe(
      '8/8/8/8/8/8/8/8 w - d6 0 1'
    );
  });

  it('serializes move counters', () => {
    const state = createMockState();

    state.currentTurn = 'b';
    state.halfmoveClock = 17;
    state.fullmoveNumber = 42;

    expect(GameStatetoFEN(state)).toBe(
      '8/8/8/8/8/8/8/8 b - - 17 42'
    );
  });

  it('rejects invalid board structures', () => {
    const state = createMockState();

    state.board = [];
    expect(() => GameStatetoFEN(state)).toThrow();

    state.board = Array(64).fill(null);
    expect(() => GameStatetoFEN(state)).toThrow();
  });

  it('rejects invalid game state fields', () => {
    const state = createMockState();

    state.currentTurn = 'x';
    expect(() => GameStatetoFEN(state)).toThrow();

    state.currentTurn = 'w';
    state.halfmoveClock = -1;
    expect(() => GameStatetoFEN(state)).toThrow();

    state.halfmoveClock = 0;
    state.fullmoveNumber = 0;
    expect(() => GameStatetoFEN(state)).toThrow();
  });
});

describe('FEN parsing', () => {
  it('parses the standard starting position', () => {
    const state = FENtoGameState(START_FEN);

    expect(state.board).toHaveLength(128);
    expect(state.currentTurn).toBe('w');
    expect(state.enPassantTarget).toBeNull();
    expect(state.halfmoveClock).toBe(0);
    expect(state.fullmoveNumber).toBe(1);

    expect(state.board[sqIndex('e1')]).toEqual(W('k'));
    expect(state.board[sqIndex('e8')]).toEqual(B('k'));
    expect(state.board[sqIndex('a1')]).toEqual(W('r'));
    expect(state.board[sqIndex('h8')]).toEqual(B('r'));
    expect(state.board[sqIndex('e2')]).toEqual(W('p'));
    expect(state.board[sqIndex('e7')]).toEqual(B('p'));

    expect(state.castlingRights).toEqual({
      wKingside: true,
      wQueenside: true,
      bKingside: true,
      bQueenside: true,
    });
  });

  it('initializes fields not stored in FEN', () => {
    const state = FENtoGameState(START_FEN);

    expect(state.moveHistory).toEqual([]);
    expect(state.positionHistory).toEqual([]);
    expect(state.status).toBe('active');
    expect(state.winner).toBeNull();
    expect(state.drawReason).toBeNull();
  });

  it('preserves null padding cells in the 0x88 board', () => {
    const state = FENtoGameState(START_FEN);

    for (let row = 0; row < 8; row++) {
      for (let col = 8; col < 16; col++) {
        expect(state.board[row * 16 + col]).toBeNull();
      }
    }
  });

  it('parses en passant targets as 0x88 indices', () => {
    const whiteToMove =
      '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2';

    const blackToMove =
      '4k3/8/8/8/3Pp3/8/8/4K3 b - d3 0 2';

    expect(FENtoGameState(whiteToMove).enPassantTarget)
      .toBe(sqIndex('d6'));

    expect(FENtoGameState(blackToMove).enPassantTarget)
      .toBe(sqIndex('d3'));
  });

  it('rejects malformed FEN structure', () => {
    const invalid = [
      '',
      '8/8/8/8/8/8/8/8',
      '8/8/8/8/8/8/8 w - - 0 1',
      '9/8/8/8/8/8/8/8 w - - 0 1',
      '7/8/8/8/8/8/8/8 w - - 0 1',
      '8/8/8/8/8/8/8/8 x - - 0 1',
      '8/8/8/8/8/8/8/8 w KK - 0 1',
      '8/8/8/8/8/8/8/8 w - e4 0 1',
      '8/8/8/8/8/8/8/8 w - e3 0 1',
      '8/8/8/8/8/8/8/8 w - - -1 1',
      '8/8/8/8/8/8/8/8 w - - 0 0',
      '8/8/8/8/8/8/8/8 w - - abc 1',
    ];

    for (const fen of invalid) {
      expect(() => FENtoGameState(fen)).toThrow();
    }
  });
});

describe('FEN round trips', () => {
  it('round-trips the starting position', () => {
    expect(GameStatetoFEN(FENtoGameState(START_FEN)))
      .toBe(START_FEN);
  });

  it('round-trips positions with different game metadata', () => {
    const positions = [
      '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
      'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
      '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2',
      '4k3/8/8/8/3Pp3/8/8/4K3 b - d3 0 2',
      '4k3/8/8/8/8/8/8/4K3 b - - 27 56',
      'Q3k3/8/8/8/8/8/8/4K3 w - - 0 10',
    ];

    for (const fen of positions) {
      expect(GameStatetoFEN(FENtoGameState(fen))).toBe(fen);
    }
  });

  it('round-trips the complete board representation', () => {
    const original = FENtoGameState(START_FEN);
    const restored = FENtoGameState(GameStatetoFEN(original));

    expect(restored.board).toEqual(original.board);
    expect(restored.currentTurn).toBe(original.currentTurn);
    expect(restored.castlingRights).toEqual(original.castlingRights);
    expect(restored.enPassantTarget).toBe(original.enPassantTarget);
    expect(restored.halfmoveClock).toBe(original.halfmoveClock);
    expect(restored.fullmoveNumber).toBe(original.fullmoveNumber);
  });
});
