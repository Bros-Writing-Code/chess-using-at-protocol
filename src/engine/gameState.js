// @ts-check
import {
  NORTH, SOUTH, EAST, WEST, SQUARES,
  findKing, fromSquare, onBoard, sqIndex, toSquare,
} from './0x88helper.js';
import { UCItoMove, GameStatetoFEN } from './notation.js';
import { boardAfterMove, isAttacked, moveGenerator } from './moveGeneration.js';

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').Color} Color */

const A1 = sqIndex('a1');
const H1 = sqIndex('h1');
const A8 = sqIndex('a8');
const H8 = sqIndex('h8');

/**
 * Return whether the current player's king is attacked.
 * This reads the existing position without changing the game state.
 *
 * @param {GameState} state
 * @returns {boolean}
 */
export function isInCheck(state) {
  if (!Array.isArray(state.board) || state.board.length !== 128) {
    throw new TypeError('state.board must be a 128-cell 0x88 board');
  }
  if (state.currentTurn !== 'w' && state.currentTurn !== 'b') {
    throw new TypeError('state.currentTurn must be w or b');
  }

  const king = findKing(state.board, state.currentTurn);
  if (king < 0) throw new Error('Current player has no king on the board');

  const opponent = state.currentTurn === 'w' ? 'b' : 'w';
  return isAttacked(state.board, king, opponent);
}

/**
 * True if neither side has enough material to checkmate: K vs K, K+B vs K,
 * K+N vs K, or kings plus bishops that all stand on the same square color.
 * Positions where mate is possible only with help (e.g. K+N+N vs K) still count
 * as sufficient, matching common online play.
 *
 * @param {GameState} state
 * @returns {boolean}
 */
export function isInsufficientMaterial(state) {
  /** @type {number[]} */
  const minors = [];
  for (const index of SQUARES) {
    const piece = state.board[index];
    if (!piece || piece.type === 'k') continue;
    if (piece.type !== 'b' && piece.type !== 'n') return false; // pawn, rook, or queen
    minors.push(index);
  }

  if (minors.length <= 1) return true; // K vs K, or a single bishop or knight

  // More than one minor piece: a draw only if all are bishops on one square color.
  const squareColor = (index) => ((index >> 4) + (index & 7)) % 2;
  return minors.every((index) =>
    state.board[index]?.type === 'b' && squareColor(index) === squareColor(minors[0]));
}

/**
 * True if the current position has occurred at least three times.
 * Uses positionHistory, whose last entry is the current position (applyMove
 * records it). A state loaded from FEN has no history, so no repetition yet.
 * Only positions since the last pawn move or capture can repeat.
 *
 * @param {GameState} state
 * @returns {boolean}
 */
function isThreefoldRepetition(state) {
  const history = state.positionHistory;
  if (!Array.isArray(history) || history.length < 5) return false;

  const current = history[history.length - 1];
  const earliest = Math.max(0, history.length - 1 - state.halfmoveClock);
  let count = 0;
  for (let i = history.length - 1; i >= earliest; i--) {
    if (history[i] === current && ++count >= 3) return true;
  }
  return false;
}

/**
 * Compute the current position's status without modifying the game state.
 * Checkmate and stalemate take priority; otherwise the game is a draw by
 * insufficient material, the fifty-move rule, or threefold repetition.
 *
 * @param {GameState} state
 * @returns {Pick<GameState, 'status' | 'winner' | 'drawReason'>}
 */
export function getGameStatus(state) {
  // A single legal move is enough to rule out checkmate and stalemate.
  let hasLegalMove = false;
  for (const index of SQUARES) {
    if (state.board[index]?.color === state.currentTurn &&
        moveGenerator(state, toSquare(index)).length > 0) {
      hasLegalMove = true;
      break;
    }
  }

  if (!hasLegalMove) {
    if (isInCheck(state)) {
      const winner = state.currentTurn === 'w' ? 'b' : 'w';
      return { status: 'checkmate', winner, drawReason: null };
    }
    return { status: 'stalemate', winner: null, drawReason: 'stalemate' };
  }

  if (isInsufficientMaterial(state)) {
    return { status: 'draw', winner: null, drawReason: 'insufficient-material' };
  }
  if (state.halfmoveClock >= 100) {
    return { status: 'draw', winner: null, drawReason: 'fifty-move-rule' };
  }
  if (isThreefoldRepetition(state)) {
    return { status: 'draw', winner: null, drawReason: 'threefold-repetition' };
  }

  return { status: 'active', winner: null, drawReason: null };
}

/**
 * Clear the castling right associated with a rook's home square.
 * @param {import('./types.js').CastlingRights} rights
 * @param {number} square
 * @param {Color} color
 */
function clearRookRight(rights, square, color) {
  if (color === 'w') {
    if (square === A1) rights.wQueenside = false;
    if (square === H1) rights.wKingside = false;
  } else {
    if (square === A8) rights.bQueenside = false;
    if (square === H8) rights.bKingside = false;
  }
}

/**
 * A repetition key contains the first four FEN fields, excluding move counters.
 * An en passant square matters only when the side to move can legally capture it.
 *
 * @param {GameState} state
 * @returns {string}
 */
function positionKey(state) {
  const fields = GameStatetoFEN(state).split(' ');
  const target = state.enPassantTarget;
  if (target !== null) {
    const forward = state.currentTurn === 'w' ? NORTH : SOUTH;
    const canCapture = [WEST, EAST].some((side) => {
      const from = target - forward + side;
      const pawn = onBoard(from) ? state.board[from] : null;
      return pawn?.type === 'p' && pawn.color === state.currentTurn &&
        moveGenerator(state, toSquare(from)).some((to) => fromSquare(to) === target);
    });
    if (!canCapture) fields[3] = '-';
  }
  return fields.slice(0, 4).join(' ');
}

/** Check the state fields applyMove needs before generating moves. */
function validMoveState(state) {
  try {
    GameStatetoFEN(state);
    if (!Array.isArray(state.moveHistory) || !Array.isArray(state.positionHistory) ||
        !state.moveHistory.every((move) => move?.from && move?.to)) return false;
    const kings = SQUARES.filter((index) => state.board[index]?.type === 'k');
    return kings.length === 2 && state.board[kings[0]].color !== state.board[kings[1]].color;
  } catch {
    return false;
  }
}

/**
 * Apply a UCI move and return a new game state; the input is never mutated.
 * Bad move strings and illegal moves are returned as Result errors.
 *
 * @param {GameState} state
 * @param {string} uci
 * @returns {import('./types.js').Result<GameState>}
 */
export function applyMove(state, uci) {
  let move;
  try {
    move = UCItoMove(uci);
  } catch {
    return { ok: false, error: 'Malformed UCI move' };
  }

  if (!validMoveState(state)) return { ok: false, error: 'Invalid game state' };

  if (state.status !== 'active') {
    return { ok: false, error: 'The game is already over' };
  }

  const from = fromSquare(move.from);
  const to = fromSquare(move.to);
  const piece = state.board[from];
  if (!piece) return { ok: false, error: 'No piece on the starting square' };
  if (piece.color !== state.currentTurn) {
    return { ok: false, error: "It is not that piece's turn" };
  }
  if (!moveGenerator(state, move.from).some((target) => fromSquare(target) === to)) {
    return { ok: false, error: 'Illegal move' };
  }

  const promotes = piece.type === 'p' && move.to.row === (piece.color === 'w' ? 0 : 7);
  if (promotes && !move.promotion) {
    return { ok: false, error: 'A promotion piece is required' };
  }
  if (!promotes && move.promotion) {
    return { ok: false, error: 'Promotion is not allowed for this move' };
  }

  const captured = state.board[to];
  // Give the new state its own piece objects as well as its own board array.
  const board = boardAfterMove(state, state.board, from, to, piece)
    .map((occupant) => occupant ? { ...occupant } : null);
  if (promotes) board[to] = { color: piece.color, type: move.promotion };

  const castlingRights = { ...state.castlingRights };
  if (piece.type === 'k') {
    if (piece.color === 'w') {
      castlingRights.wKingside = false;
      castlingRights.wQueenside = false;
    } else {
      castlingRights.bKingside = false;
      castlingRights.bQueenside = false;
    }
  }
  if (piece.type === 'r') clearRookRight(castlingRights, from, piece.color);
  if (captured?.type === 'r') clearRookRight(castlingRights, to, captured.color);

  const twoSquarePawnMove = piece.type === 'p' && Math.abs(to - from) === 2 * Math.abs(NORTH);
  const enPassantTarget = twoSquarePawnMove
    ? from + (piece.color === 'w' ? NORTH : SOUTH)
    : null;

  const next = {
    ...state,
    board,
    currentTurn: /** @type {Color} */ (piece.color === 'w' ? 'b' : 'w'),
    castlingRights,
    enPassantTarget,
    halfmoveClock: piece.type === 'p' || captured ? 0 : state.halfmoveClock + 1,
    fullmoveNumber: state.fullmoveNumber + (piece.color === 'b' ? 1 : 0),
    moveHistory: [
      ...state.moveHistory.map((pastMove) => ({
        ...pastMove, from: { ...pastMove.from }, to: { ...pastMove.to },
      })),
      move,
    ],
    positionHistory: [
      ...(state.positionHistory.length ? state.positionHistory : [positionKey(state)]),
    ],
    status: /** @type {const} */ ('active'),
    winner: null,
    drawReason: null,
  };
  next.positionHistory.push(positionKey(next));

  return { ok: true, value: { ...next, ...getGameStatus(next) } };
}

/*
 * Function outline from the original scaffold (not executable code):
 *
 * applyMove(GameState, uci)            (implemented above)
 * getUCI(Move) -> string                 (implemented as moveToUCI in notation.js)
 * GameStatetoFEN(GameState) -> string   (implemented in notation.js)
 * FENtoGameState(FEN) -> GameState      (implemented in notation.js)
 * isStalemate(state) -> bool           (covered by getGameStatus)
 * isCheckmate(state) -> bool           (covered by getGameStatus)
 * getGameState()
 */
