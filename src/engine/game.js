// @ts-check
/**
 * game.js — small pure helpers for starting, reading, and replaying games.
 *
 * Every function here is pure: it never mutates its input and never stores
 * a game. The caller owns all GameState objects.
 */

import { SQUARES, toIndex, toSquare } from './0x88helper.js';
import { FENtoGameState, moveToUCI } from './notation.js';
import { moveGenerator } from './moveGeneration.js';
import { applyMove, getGameStatus } from './gameState.js';

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').Piece} Piece */
/** @typedef {import('./types.js').Square} Square */
/**
 * @template T
 * @typedef {import('./types.js').Result<T>} Result
 */

/** FEN of the standard starting position. */
export const START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Parses a FEN and fills in status / winner / drawReason for that position,
 * so a game loaded from a finished position is already marked as over.
 *
 * @param {string} fen
 * @returns {GameState}
 * @throws {Error} If the FEN is malformed.
 */
function stateFromFEN(fen) {
  const state = FENtoGameState(fen);
  return { ...state, ...getGameStatus(state) };
}

/**
 * Creates a new game. Returns a fresh object on every call, so two games
 * never share a board. The status already reflects the position, so a
 * checkmate or stalemate FEN starts as finished.
 *
 * @param {string} [fen=START_FEN] - Starting position.
 * @returns {GameState}
 * @throws {Error} If the FEN is malformed (use replayMoves for untrusted input).
 * @example const state = createGame();
 */
export function createGame(fen = START_FEN) {
  return stateFromFEN(fen);
}

/**
 * True if `square` is a {row, col} object with both values in 0-7.
 * @param {unknown} square
 * @returns {square is Square}
 */
function isValidSquare(square) {
  const s = /** @type {any} */ (square);
  return !!s &&
    Number.isInteger(s.row) && s.row >= 0 && s.row <= 7 &&
    Number.isInteger(s.col) && s.col >= 0 && s.col <= 7;
}

/**
 * Returns a copy of the piece on a square, or null if it is empty.
 * It is a copy, so changing it never changes the game state.
 *
 * @param {GameState} state
 * @param {Square} square - {row, col}, row 0 = rank 8, col 0 = file a.
 * @returns {Piece|null}
 * @throws {Error} If the square is outside the board.
 * @example getPiece(createGame(), { row: 7, col: 4 }) // { color: 'w', type: 'k' }
 */
export function getPiece(state, square) {
  if (!isValidSquare(square)) {
    throw new Error(`Invalid square: ${JSON.stringify(square)}`);
  }
  const piece = state.board[toIndex(square.row, square.col)];
  return piece ? { ...piece } : null;
}

/**
 * Returns the board as an 8x8 array for rendering: grid[row][col], with
 * row 0 = rank 8 (Black's back rank) and col 0 = file a.
 * The grid and its pieces are copies; changing them does not change the state.
 *
 * @param {GameState} state
 * @returns {Array<Array<Piece|null>>}
 * @example toGrid(createGame())[7][4] // { color: 'w', type: 'k' } (e1)
 */
export function toGrid(state) {
  const grid = [];
  for (let row = 0; row < 8; row++) {
    const cells = [];
    for (let col = 0; col < 8; col++) {
      const piece = state.board[toIndex(row, col)];
      cells.push(piece ? { ...piece } : null);
    }
    grid.push(cells);
  }
  return grid;
}

/**
 * Legal destinations for the piece on `square`, for highlighting.
 * Returns [] once the game is over, matching legalMoves and isValidMove.
 *
 * @param {GameState} state
 * @param {Square} square - {row, col} of the selected piece.
 * @returns {Square[]}
 * @example legalMovesFrom(createGame(), { row: 6, col: 4 }) // e2 → e3, e4
 */
export function legalMovesFrom(state, square) {
  if (state.status !== 'active') return [];
  return moveGenerator(state, square);
}

/**
 * Returns every legal move for the side to move, as UCI strings.
 * Promotions appear once per piece choice (e.g. "a7a8q", "a7a8r", ...).
 * Useful for building a board library's destination map, or for bots.
 *
 * @param {GameState} state
 * @returns {string[]}
 * @example legalMoves(createGame()).length // 20
 */
export function legalMoves(state) {
  if (state.status !== 'active') return [];

  /** @type {string[]} */
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

/**
 * True if `uci` is a legal move for the side to move.
 * Never throws; malformed input simply returns false.
 *
 * @param {GameState} state
 * @param {string} uci - e.g. "e2e4", "e7e8q".
 * @returns {boolean}
 */
export function isValidMove(state, uci) {
  return applyMove(state, uci).ok;
}

/**
 * Rebuilds a game by replaying UCI moves in order, e.g. after a page refresh.
 * Stops at the first move that is malformed or illegal.
 *
 * @param {string[]} ucis - Moves in play order (sorted by ply).
 * @param {string} [startFen=START_FEN] - Position the moves start from.
 * @returns {Result<GameState>}
 * @example replayMoves(['e2e4', 'e7e5']) // { ok: true, value: GameState }
 */
export function replayMoves(ucis, startFen = START_FEN) {
  if (!Array.isArray(ucis)) {
    return { ok: false, error: 'Moves must be an array of UCI strings.' };
  }

  /** @type {GameState} */
  let state;
  try {
    state = stateFromFEN(startFen);
  } catch (e) {
    return { ok: false, error: `Invalid start position: ${/** @type {Error} */ (e).message}` };
  }

  for (let i = 0; i < ucis.length; i++) {
    const result = applyMove(state, ucis[i]);
    if (!result.ok) {
      return { ok: false, error: `Move ${i + 1} (${ucis[i]}): ${result.error}` };
    }
    state = result.value;
  }

  return { ok: true, value: state };
}
