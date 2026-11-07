// @ts-check
/**
 * 0x88helper.js — abstractions for all the 0x88 computations.
 *
 * Every other engine file (moveGeneration, gameState, attacks, fen) imports
 * from here, so nobody else needs to know the 0x88 math.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * HOW 0x88 WORKS
 *
 * The board is ONE array of 128 cells: 8 rows × 16 columns.
 * Only the LEFT 8 columns are real squares; the right 8 are padding.
 *
 *     index = 16 × row + col          (row and col both 0–7)
 *
 * ORIENTATION — same convention as Square in types.js:
 *   row 0 = rank 8 (Black's back rank), row 7 = rank 1 (White's back rank)
 *   col 0 = file a, col 7 = file h
 *
 *          a   b   c   d   e   f   g   h     padding
 *   rank 8   0   1   2   3   4   5   6   7 │   8 …  15
 *   rank 7  16  17  18  19  20  21  22  23 │  24 …  31
 *   rank 6  32  33  34  35  36  37  38  39 │  40 …  47
 *   rank 5  48  49  50  51  52  53  54  55 │  56 …  63
 *   rank 4  64  65  66  67  68  69  70  71 │  72 …  79
 *   rank 3  80  81  82  83  84  85  86  87 │  88 …  95
 *   rank 2  96  97  98  99 100 101 102 103 │ 104 … 111
 *   rank 1 112 113 114 115 116 117 118 119 │ 120 … 127
 *
 * So a8 = 0, h8 = 7, a1 = 112, h1 = 119, e4 = 68, e1 = 116, e8 = 4.
 * Moving NORTH (toward Black, up the board) = −16; EAST (toward h) = +1.
 *
 * WHY THE PADDING: stepping off the board always lands on an index with bit
 * 0x08 set (past the a- or h-file wraps into padding) or bit 0x80 set /
 * negative (past rank 1 or rank 8). So one bit test, (i & 0x88) !== 0,
 * means "off the board". Reference: Chess Programming Wiki, "0x88".
 * ─────────────────────────────────────────────────────────────────────────
 */

/** @typedef {import('./types.js').Piece} Piece */
/** @typedef {import('./types.js').Square} Square */
/** @typedef {import('./types.js').Color} Color */
/** @typedef {(Piece | null)[]} Board0x88  128 cells; padding cells are always null */

/** Number of cells in a 0x88 board array. */
export const BOARD_SIZE = 128;

/** One-square step offsets (row 0 = rank 8, so "up the board" is negative). */
export const NORTH = -16; // toward rank 8 (Black's side)
export const SOUTH = 16;  // toward rank 1 (White's side)
export const EAST = 1;    // toward the h-file
export const WEST = -1;   // toward the a-file

/* ────────────────────────── Index conversions ─────────────────────────── */

/**
 * Index from row and col (both 0–7), using the types.js convention.
 * @param {number} row 0 = rank 8 … 7 = rank 1
 * @param {number} col 0 = file a … 7 = file h
 * @returns {number}
 * @example toIndex(4, 4) // 68 (e4)
 */
export function toIndex(row, col) {
  return 16 * row + col;
}

/** Row (0–7) of an index. @param {number} i @returns {number} */
export const rowOf = (i) => i >> 4;

/** Col (0–7) of an index. @param {number} i @returns {number} */
export const colOf = (i) => i & 7;

/**
 * Square object from types.js → index.
 * @param {Square} sq
 * @returns {number}
 * @example fromSquare({ row: 4, col: 4 }) // 68 (e4)
 */
export function fromSquare(sq) {
  return toIndex(sq.row, sq.col);
}

/**
 * Index → Square object from types.js.
 * @param {number} i
 * @returns {Square}
 * @throws {Error} if `i` is off the board
 */
export function toSquare(i) {
  if (!onBoard(i)) throw new Error(`Index is off the board: ${i}`);
  return { row: rowOf(i), col: colOf(i) };
}

/**
 * True if `name` is a valid square name like "e4".
 * @param {string} name
 * @returns {boolean}
 */
export function isSquareName(name) {
  return typeof name === 'string' && /^[a-h][1-8]$/.test(name);
}

/**
 * Square name ("e4") → index. Used by UCI and FEN code.
 * @param {string} name
 * @returns {number}
 * @throws {Error} if `name` is not a valid square
 * @example sqIndex('a8') // 0
 * @example sqIndex('e4') // 68
 * @example sqIndex('h1') // 119
 */
export function sqIndex(name) {
  if (!isSquareName(name)) throw new Error(`Invalid square name: ${name}`);
  const col = name.charCodeAt(0) - 97;      // 'a' = 97
  const row = 8 - (name.charCodeAt(1) - 48); // '8' → 0 … '1' → 7
  return toIndex(row, col);
}

/**
 * Index → square name ("e4").
 * @param {number} i
 * @returns {string}
 * @throws {Error} if `i` is off the board
 * @example sqName(68) // "e4"
 */
export function sqName(i) {
  if (!onBoard(i)) throw new Error(`Index is off the board: ${i}`);
  return String.fromCharCode(97 + colOf(i)) + (8 - rowOf(i));
}

/* ─────────────────────────── Board queries ────────────────────────────── */

/**
 * True if `i` is a real square (not padding, not out of range).
 * @param {number} i
 * @returns {boolean}
 * @example onBoard(68)               // true  (e4)
 * @example onBoard(sqIndex('h4') + EAST)  // false (off the h-file)
 * @example onBoard(sqIndex('e8') + NORTH) // false (past rank 8)
 */
export function onBoard(i) {
  return Number.isInteger(i) && i >= 0 && (i & 0x88) === 0;
}

/**
 * Piece on a square, or null (also null for off-board indexes).
 * @param {Board0x88} board
 * @param {number} i
 * @returns {Piece | null}
 */
export function pieceAt(board, i) {
  return onBoard(i) ? board[i] : null;
}

/**
 * All 64 real square indexes, a8 → h1 (row by row, like FEN).
 * @returns {number[]}
 */
export function allSquares() {
  const out = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    if (i & 0x88) { i += 7; continue; } // jump over the 8 padding cells
    out.push(i);
  }
  return out;
}

/**
 * Cached list of the 64 real squares. Loop over this instead of 0..127
 * so padding is skipped automatically. Frozen: do not modify.
 */
export const SQUARES = Object.freeze(allSquares());

/**
 * Indexes of every square whose piece passes `test`.
 * @param {Board0x88} board
 * @param {(p: Piece) => boolean} test
 * @returns {number[]}
 * @example findSquares(board, p => p.type === 'n' && p.color === 'w') // [113, 118] at start (b1, g1)
 */
export function findSquares(board, test) {
  return SQUARES.filter((i) => board[i] !== null && test(/** @type {Piece} */ (board[i])));
}

/**
 * Index of a color's king, or -1 if there is none.
 * @param {Board0x88} board
 * @param {Color} color
 * @returns {number}
 */
export function findKing(board, color) {
  for (const i of SQUARES) {
    const p = board[i];
    if (p && p.type === 'k' && p.color === color) return i;
  }
  return -1;
}

/* ───────────────────────── Creating / copying ─────────────────────────── */

/**
 * A new empty board (128 nulls).
 * @returns {Board0x88}
 */
export function emptyBoard() {
  return new Array(BOARD_SIZE).fill(null);
}

/**
 * Shallow copy of a board (new array, same piece objects). Pieces are
 * treated as immutable values, so this is enough: applyMove copies the
 * board, then edits the copy, and the original is never changed.
 * @param {Board0x88} board
 * @returns {Board0x88}
 */
export function cloneBoard(board) {
  return board.slice();
}

/**
 * Returns a NEW board with `piece` on `i` (original unchanged).
 * Handy for building test positions.
 * @param {Board0x88} board
 * @param {number} i
 * @param {Piece | null} piece
 * @returns {Board0x88}
 */
export function withPiece(board, i, piece) {
  if (!onBoard(i)) throw new Error(`Index is off the board: ${i}`);
  const next = cloneBoard(board);
  next[i] = piece;
  return next;
}

/* ─────────────────────────────── Debug ────────────────────────────────── */

/**
 * ASCII picture of the board (uppercase = White, lowercase = Black).
 * Returns the text so tests can compare it; also logs it if `log` is true.
 * @param {Board0x88} board
 * @param {boolean} [log=true]
 * @returns {string}
 * @example
 *   8 r n b q k b n r
 *   7 p p p p p p p p
 *   …
 *   1 R N B Q K B N R
 *     a b c d e f g h
 */
export function printBoard(board, log = true) {
  const lines = [];
  for (let row = 0; row < 8; row++) {
    const cells = [];
    for (let col = 0; col < 8; col++) {
      const p = board[toIndex(row, col)];
      cells.push(p ? (p.color === 'w' ? p.type.toUpperCase() : p.type) : '.');
    }
    lines.push(`${8 - row} ${cells.join(' ')}`);
  }
  lines.push('  a b c d e f g h');
  const text = lines.join('\n');
  if (log) console.log(text);
  return text;
}
