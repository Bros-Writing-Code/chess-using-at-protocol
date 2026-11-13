import {
  NORTH, SOUTH, EAST, WEST,
  findKing, fromSquare, onBoard, pieceAt, rowOf, toIndex, toSquare,
} from './0x88helper.js';

const DIAGONALS = [NORTH + WEST, NORTH + EAST, SOUTH + WEST, SOUTH + EAST];
const STRAIGHTS = [NORTH, SOUTH, WEST, EAST];
const ALL_DIRECTIONS = [...DIAGONALS, ...STRAIGHTS];
const KNIGHT_OFFSETS = [-33, -31, -18, -14, 14, 18, 31, 33];

// The engine stores the board as a 128-cell 0x88 array.
function boardOf(state) {
  if (!Array.isArray(state.board) || state.board.length !== 128) {
    throw new TypeError('state.board must be a 128-cell 0x88 board');
  }
  return state.board;
}

// Validate coordinates before converting; invalid values could map to another valid square.
function indexOf(square) {
  if (!square || !Number.isInteger(square.row) || !Number.isInteger(square.col) ||
      square.row < 0 || square.row > 7 || square.col < 0 || square.col > 7) return -1;
  return fromSquare(square);
}

function canLand(board, to, color) {
  if (!onBoard(to)) return false;
  const target = pieceAt(board, to);
  // A king cannot be captured; attacked-square checks handle check instead.
  return !target || (target.color !== color && target.type !== 'k');
}

// Fixed-offset moves for knights and kings.
function stepMoves(board, from, color, offsets) {
  return offsets.map(offset => from + offset).filter(to => canLand(board, to, color));
}

// Scan rays for bishops, rooks, and queens; stop at the first occupied square.
function slidingMoves(board, from, color, directions) {
  const moves = [];
  for (const direction of directions) {
    for (let to = from + direction; onBoard(to); to += direction) {
      const target = pieceAt(board, to);
      if (!target) moves.push(to);
      else {
        if (target.color !== color && target.type !== 'k') moves.push(to);
        break;
      }
    }
  }
  return moves;
}

function pawnMoves(state, board, from, color) {
  const moves = [];
  const forward = color === 'w' ? NORTH : SOUTH;
  const one = from + forward;
  if (onBoard(one) && !pieceAt(board, one)) {
    moves.push(one);
    const startRow = color === 'w' ? 6 : 1;
    const two = one + forward;
    if (rowOf(from) === startRow && !pieceAt(board, two)) moves.push(two);
  }
  const ep = state.enPassantTarget;
  for (const side of [WEST, EAST]) {
    const to = from + forward + side;
    if (!onBoard(to)) continue;
    const target = pieceAt(board, to);
    if (target && target.color !== color && target.type !== 'k') moves.push(to);
    else if (!target && to === ep) {
      // En passant requires an empty target square and an adjacent enemy pawn.
      const captured = pieceAt(board, from + side);
      if (captured?.type === 'p' && captured.color !== color) moves.push(to);
    }
  }
  return moves;
}

// Check whether a color attacks a square; pawn attacks differ from pawn advances.
export function isAttacked(board, target, color) {
  const forward = color === 'w' ? NORTH : SOUTH;
  for (const side of [WEST, EAST]) {
    const pawn = pieceAt(board, target - forward - side);
    if (pawn?.color === color && pawn.type === 'p') return true;
  }
  for (const offset of KNIGHT_OFFSETS) {
    const knight = pieceAt(board, target + offset);
    if (knight?.color === color && knight.type === 'n') return true;
  }
  for (const direction of ALL_DIRECTIONS) {
    const diagonal = DIAGONALS.includes(direction);
    let distance = 1;
    for (let from = target + direction; onBoard(from); from += direction, distance++) {
      const attacker = pieceAt(board, from);
      if (!attacker) continue;
      if (attacker.color === color &&
          (attacker.type === 'q' || (diagonal ? attacker.type === 'b' : attacker.type === 'r') ||
           (distance === 1 && attacker.type === 'k'))) return true;
      break;
    }
  }
  return false;
}

function kingMoves(state, board, from, color) {
  const moves = stepMoves(board, from, color, ALL_DIRECTIONS);
  const homeRow = color === 'w' ? 7 : 0;
  if (from !== toIndex(homeRow, 4)) return moves;
  const enemy = color === 'w' ? 'b' : 'w';
  if (isAttacked(board, from, enemy)) return moves;
  for (const kingside of [true, false]) {
    const allowed = color === 'w'
      ? (kingside ? state.castlingRights?.wKingside : state.castlingRights?.wQueenside)
      : (kingside ? state.castlingRights?.bKingside : state.castlingRights?.bQueenside);
    if (!allowed) continue;
    const rook = pieceAt(board, toIndex(homeRow, kingside ? 7 : 0));
    if (rook?.type !== 'r' || rook.color !== color) continue;
    const between = kingside ? [5, 6] : [3, 2, 1];
    if (between.some(col => pieceAt(board, toIndex(homeRow, col)))) continue;
    const step = kingside ? EAST : WEST;
    if (isAttacked(board, from + step, enemy) || isAttacked(board, from + 2 * step, enemy)) continue;
    moves.push(from + 2 * step);
  }
  return moves;
}

// Generate moves by piece type; moveGenerator later removes moves that expose the king.
function candidates(state, board, from, piece) {
  const { color, type } = piece;
  switch (type) {
    case 'p': return pawnMoves(state, board, from, color);
    case 'n': return stepMoves(board, from, color, KNIGHT_OFFSETS);
    case 'b': return slidingMoves(board, from, color, DIAGONALS);
    case 'r': return slidingMoves(board, from, color, STRAIGHTS);
    case 'q': return slidingMoves(board, from, color, ALL_DIRECTIONS);
    case 'k': return kingMoves(state, board, from, color);
    default: return [];
  }
}

function possibleMoves(state, square, type) {
  const from = indexOf(square);
  if (from < 0) return [];
  const board = boardOf(state);
  const piece = pieceAt(board, from);
  if (!piece || piece.type !== type) return [];
  return candidates(state, board, from, piece).map(toSquare);
}

// These six functions return candidate squares without checking whether the king remains safe.
export const getPossibleMovesPawn = (state, square) => possibleMoves(state, square, 'p');
export const getPossibleMovesBishop = (state, square) => possibleMoves(state, square, 'b');
export const getPossibleMovesKnight = (state, square) => possibleMoves(state, square, 'n');
export const getPossibleMovesRook = (state, square) => possibleMoves(state, square, 'r');
export const getPossibleMovesQueen = (state, square) => possibleMoves(state, square, 'q');
export const getPossibleMovesKing = (state, square) => possibleMoves(state, square, 'k');

// Simulate a move on a copy, including en passant captures and castling rook moves.
export function boardAfterMove(state, board, from, to, piece) {
  const next = board.slice();
  next[from] = null;
  next[to] = piece;
  if (piece.type === 'p' && to === state.enPassantTarget &&
      !pieceAt(board, to) && Math.abs(to - from) !== 16) {
    next[to + (piece.color === 'w' ? SOUTH : NORTH)] = null;
  }
  if (piece.type === 'k' && Math.abs(to - from) === 2) {
    const kingside = to > from;
    const rookFrom = toIndex(rowOf(from), kingside ? 7 : 0);
    next[from + (kingside ? EAST : WEST)] = next[rookFrom];
    next[rookFrom] = null;
  }
  return next;
}

// Return legal target squares for the current player's selected piece without mutating state.
export function moveGenerator(state, selectedSquare) {
  const from = indexOf(selectedSquare);
  if (from < 0) return [];
  const board = boardOf(state);
  const piece = pieceAt(board, from);
  if (!piece || piece.color !== state.currentTurn) return [];
  const enemy = piece.color === 'w' ? 'b' : 'w';
  return candidates(state, board, from, piece).filter(to => {
    const next = boardAfterMove(state, board, from, to, piece);
    const king = piece.type === 'k' ? to : findKing(next, piece.color);
    return king < 0 || !isAttacked(next, king, enemy);
  }).map(toSquare);
}
