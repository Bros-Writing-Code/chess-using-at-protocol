// @ts-check
/**
 * notation.js — conversions between chess notation and engine data.
 *
 * This file handles two standard chess notation formats:
 *   1. UCI — represents individual moves.
 *   2. FEN — represents a complete chess position.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * UCI — UNIVERSAL CHESS INTERFACE
 *
 * A UCI move consists of:
 *   - Two characters for the starting square.
 *   - Two characters for the destination square.
 *   - An optional promotion piece (q, r, b, or n).
 *
 * Examples:
 *   e2e4  = pawn moves from e2 to e4
 *   g1f3  = knight moves from g1 to f3
 *   e1g1  = White castles kingside
 *   e7e8q = pawn promotes to a queen
 *
 * UCI does not explicitly identify captures, checks, or en passant.
 * These are determined by the rules engine using the current state.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FEN — FORSYTH-EDWARDS NOTATION
 *
 * FEN represents a chess position using six space-separated fields:
 *
 *   1. Piece placement
 *   2. Active player
 *   3. Castling rights
 *   4. En passant target
 *   5. Halfmove clock
 *   6. Fullmove number
 *
 * Starting position:
 *
 *   rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
 *
 * Piece placement:
 *   - Eight ranks separated by '/'.
 *   - Ranks are listed from rank 8 to rank 1.
 *   - Uppercase letters represent White pieces.
 *   - Lowercase letters represent Black pieces.
 *   - Digits represent consecutive empty squares.
 *
 * Active player:
 *   w = White to move
 *   b = Black to move
 *
 * Castling rights:
 *   K = White kingside
 *   Q = White queenside
 *   k = Black kingside
 *   q = Black queenside
 *   - = No castling rights
 *
 * En passant:
 *   The square a pawn passed over during a two-square advance, or '-'.
 *   For example, after e2e4, the target is e3.
 *
 * Halfmove clock:
 *   Number of halfmoves since the last pawn move or capture.
 *
 * Fullmove number:
 *   Starts at 1 and increments after Black moves.
 *
 * ─────────────────────────────────────────────────────────────────────────
 */

import {
  sqIndex,
  sqName,
  fromSquare,
  toSquare,
  toIndex,
  emptyBoard,
} from './0x88helper.js';

/** @typedef {import('./types.js').Move} Move */
/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').Piece} Piece */
/** @typedef {import('./types.js').PieceType} PieceType */
/** @typedef {import('./types.js').PromotionType} PromotionType */
/** @typedef {import('./types.js').Color} Color */

/* ─────────────────────────── UCI conversions ─────────────────────────── */

/**
 * Converts a Move object into UCI notation.
 *
 * Castling is represented as a king move.
 * En passant is represented as an ordinary coordinate move.
 *
 * @param {Move} move - Move to convert.
 * @returns {string} UCI notation.
 * @throws {Error} If coordinates or promotion are invalid.
 *
 * @example
 * moveToUCI({
 *   from: { row: 6, col: 4 },
 *   to: { row: 4, col: 4 }
 * }) // "e2e4"
 */
export function moveToUCI(move) {
  // Validate coordinates before conversion. fromSquare() itself
  // does not necessarily reject coordinates outside 0-7.
  for (const square of [move.from, move.to]) {
    if (!square ||
        !Number.isInteger(square.row) ||
        !Number.isInteger(square.col) ||
        square.row < 0 || square.row > 7 ||
        square.col < 0 || square.col > 7) {
      throw new Error('Invalid move coordinates.');
    }
  }

  let uci = sqName(fromSquare(move.from)) +
            sqName(fromSquare(move.to));

  if (move.promotion !== undefined) {
    if (!['q', 'r', 'b', 'n'].includes(move.promotion)) {
      throw new Error(`Invalid promotion piece: ${move.promotion}`);
    }

    uci += move.promotion;
  }

  return uci;
}

/**
 * Converts a UCI string into a Move object.
 *
 * This function parses notation but does not validate move legality.
 * Castling and en passant are determined from the game state.
 *
 * @param {string} uci - UCI move string.
 * @returns {Move} Parsed move.
 * @throws {Error} If UCI notation is malformed.
 *
 * @example
 * UCItoMove("e7e8q")
 * // {
 * //   from: { row: 1, col: 4 },
 * //   to: { row: 0, col: 4 },
 * //   promotion: 'q'
 * // }
 */
export function UCItoMove(uci) {
  if (typeof uci !== 'string' ||
      !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
    throw new Error(`Invalid UCI notation: ${uci}`);
  }

  /** @type {Move} */
  const move = {
    from: toSquare(sqIndex(uci.slice(0, 2))),
    to: toSquare(sqIndex(uci.slice(2, 4))),
  };

  if (uci.length === 5) {
    move.promotion = /** @type {PromotionType} */ (uci[4]);
  }

  return move;
}

/* ─────────────────────────── FEN conversions ─────────────────────────── */

/**
 * Converts a GameState into Forsyth-Edwards Notation (FEN).
 *
 * Iterates over the 64 valid squares in rank order, ignoring
 * the padding cells in the 0x88 board.
 *
 * @param {GameState} state - Game state to serialize.
 * @returns {string} Six-field FEN representation.
 * @throws {Error} If the game state contains invalid FEN data.
 */
export function GameStatetoFEN(state) {
  if (!Array.isArray(state.board) || state.board.length !== 128) {
    throw new Error('GameState must contain a 128-cell board.');
  }

  const ranks = [];

  for (let row = 0; row < 8; row++) {
    let rank = '';
    let emptyCount = 0;

    for (let col = 0; col < 8; col++) {
      const piece = state.board[toIndex(row, col)];

      if (piece === null) {
        emptyCount++;
        continue;
      }

      if (emptyCount > 0) {
        rank += emptyCount;
        emptyCount = 0;
      }

      if (!piece ||
          !['p', 'n', 'b', 'r', 'q', 'k'].includes(piece.type) ||
          !['w', 'b'].includes(piece.color)) {
        throw new Error('Invalid piece on board.');
      }

      rank += piece.color === 'w'
        ? piece.type.toUpperCase()
        : piece.type;
    }

    if (emptyCount > 0) rank += emptyCount;
    ranks.push(rank);
  }

  if (state.currentTurn !== 'w' && state.currentTurn !== 'b') {
    throw new Error('Invalid current turn.');
  }

  const rights = state.castlingRights;

  if (!rights ||
      typeof rights.wKingside !== 'boolean' ||
      typeof rights.wQueenside !== 'boolean' ||
      typeof rights.bKingside !== 'boolean' ||
      typeof rights.bQueenside !== 'boolean') {
    throw new Error('Invalid castling rights.');
  }

  let castling = '';
  if (rights.wKingside) castling += 'K';
  if (rights.wQueenside) castling += 'Q';
  if (rights.bKingside) castling += 'k';
  if (rights.bQueenside) castling += 'q';
  if (!castling) castling = '-';

  let ep = '-';
  if (state.enPassantTarget !== null) {
    ep = sqName(state.enPassantTarget);
    // Validate that the target rank matches the active player's turn direction
    const expectedRank = state.currentTurn === 'w' ? '6' : '3';
    if (ep[1] !== expectedRank) {
      throw new Error('En passant target conflicts with active player turn rank.');
    }
  }

  if (!Number.isSafeInteger(state.halfmoveClock) ||
      state.halfmoveClock < 0 ||
      !Number.isSafeInteger(state.fullmoveNumber) ||
      state.fullmoveNumber < 1) {
    throw new Error('Invalid move counters.');
  }

  return [
    ranks.join('/'),
    state.currentTurn,
    castling,
    ep,
    state.halfmoveClock,
    state.fullmoveNumber,
  ].join(' ');
}

/**
 * Converts a FEN string into a GameState.
 *
 * Creates a new 128-cell board and populates its valid squares.
 * FEN does not include game history, so historical fields are
 * initialized as empty arrays.
 *
 * This function validates FEN syntax, not full chess legality.
 *
 * @param {string} fen - Six-field FEN string.
 * @returns {GameState} Parsed game state.
 * @throws {Error} If the FEN string is malformed.
 */
export function FENtoGameState(fen) {
  if (typeof fen !== 'string') {
    throw new Error('FEN must be a string.');
  }

  const fields = fen.trim().split(/\s+/);
  if (fields.length !== 6) {
    throw new Error('FEN must contain exactly six fields.');
  }

  const [placement, turn, castling, ep, halfmove, fullmove] = fields;
  const ranks = placement.split('/');

  if (ranks.length !== 8) {
    throw new Error('FEN must contain exactly eight ranks.');
  }

  const board = emptyBoard();

  for (let row = 0; row < 8; row++) {
    let col = 0;

    for (const char of ranks[row]) {
      if (/^[1-8]$/.test(char)) {
        col += Number(char);
      } else if (/^[pnbrqkPNBRQK]$/.test(char)) {
        if (col >= 8) {
          throw new Error(`FEN rank ${8 - row} exceeds eight squares.`);
        }

        /** @type {Piece} */
        const piece = {
          color: char === char.toUpperCase() ? 'w' : 'b',
          type: /** @type {PieceType} */ (char.toLowerCase()),
        };

        board[toIndex(row, col)] = piece;
        col++;
      } else {
        throw new Error(`Invalid FEN character: ${char}`);
      }

      if (col > 8) {
        throw new Error(`FEN rank ${8 - row} exceeds eight squares.`);
      }
    }

    if (col !== 8) {
      throw new Error(`FEN rank ${8 - row} must contain eight squares.`);
    }
  }

  if (turn !== 'w' && turn !== 'b') {
    throw new Error('Invalid active player.');
  }

  if (!/^(?:-|K?Q?k?q?)$/.test(castling) || castling === '') {
    throw new Error('Invalid castling rights.');
  }

  const castlingRights = {
    wKingside: castling.includes('K'),
    wQueenside: castling.includes('Q'),
    bKingside: castling.includes('k'),
    bQueenside: castling.includes('q'),
  };

  /** @type {number|null} */
  let enPassantTarget = null;

  if (ep !== '-') {
    if (!/^[a-h][36]$/.test(ep)) {
      throw new Error('Invalid en passant target.');
    }

    const expectedRank = turn === 'w' ? '6' : '3';
    if (ep[1] !== expectedRank) {
      throw new Error('En passant target conflicts with active player.');
    }

    enPassantTarget = sqIndex(ep);
  }

  if (!/^\d+$/.test(halfmove) || !/^\d+$/.test(fullmove)) {
    throw new Error('Invalid move counters.');
  }

  const halfmoveClock = Number(halfmove);
  const fullmoveNumber = Number(fullmove);

  if (!Number.isSafeInteger(halfmoveClock) ||
      !Number.isSafeInteger(fullmoveNumber) ||
      fullmoveNumber < 1) {
    throw new Error('Invalid move counters.');
  }

  return {
    board,
    currentTurn: /** @type {Color} */ (turn),
    castlingRights,
    enPassantTarget,
    halfmoveClock,
    fullmoveNumber,
    moveHistory: [],
    positionHistory: [],
    status: 'active',
    winner: null,
    drawReason: null,
  };
}