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
 * Compute the current position's status without modifying the game state.
 * Draw conditions other than stalemate are handled separately.
 *
 * @param {GameState} state
 * @returns {Pick<GameState, 'status' | 'winner' | 'drawReason'>}
 */
export function getGameStatus(state) {
  const inCheck = isInCheck(state);

  // A single legal move is enough to rule out checkmate and stalemate.
  for (const index of SQUARES) {
    if (state.board[index]?.color === state.currentTurn &&
        moveGenerator(state, toSquare(index)).length > 0) {
      return { status: 'active', winner: null, drawReason: null };
    }
  }

  if (inCheck) {
    const winner = state.currentTurn === 'w' ? 'b' : 'w';
    return { status: 'checkmate', winner, drawReason: null };
  }

  return { status: 'stalemate', winner: null, drawReason: 'stalemate' };
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
    return { ok: false, error: 'It is not that piece’s turn' };
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
