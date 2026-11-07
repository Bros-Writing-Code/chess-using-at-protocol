import { describe, it, expect } from 'vitest';
import {
  sqIndex, sqName, onBoard, pieceAt, toIndex, rowOf, colOf, fromSquare, toSquare,
  isSquareName, SQUARES, emptyBoard, cloneBoard, withPiece, findSquares, findKing,
  printBoard, NORTH, SOUTH, EAST, WEST,
} from '../0x88helper.js';

const W = (type) => ({ type, color: 'w' });
const B = (type) => ({ type, color: 'b' });

describe('index conversions', () => {
  it('maps corners and key squares (row 0 = rank 8)', () => {
    expect(sqIndex('a8')).toBe(0);
    expect(sqIndex('h8')).toBe(7);
    expect(sqIndex('a1')).toBe(112);
    expect(sqIndex('h1')).toBe(119);
    expect(sqIndex('e4')).toBe(68);
    expect(sqIndex('e1')).toBe(116);
  });

  it('round-trips all 64 square names', () => {
    for (const f of 'abcdefgh') for (const r of '12345678') {
      expect(sqName(sqIndex(f + r))).toBe(f + r);
    }
  });

  it('matches the Square {row, col} convention in types.js', () => {
    expect(fromSquare({ row: 0, col: 0 })).toBe(sqIndex('a8'));
    expect(fromSquare({ row: 7, col: 7 })).toBe(sqIndex('h1'));
    expect(toSquare(sqIndex('e4'))).toEqual({ row: 4, col: 4 });
    expect(toIndex(4, 4)).toBe(68);
    expect(rowOf(68)).toBe(4);
    expect(colOf(68)).toBe(4);
  });

  it('rejects bad input', () => {
    expect(isSquareName('i1')).toBe(false);
    expect(isSquareName('e9')).toBe(false);
    expect(() => sqIndex('z9')).toThrow();
    expect(() => sqName(8)).toThrow();   // padding
    expect(() => sqName(-1)).toThrow();
    expect(() => toSquare(200)).toThrow();
  });
});

describe('onBoard and directions', () => {
  it('exactly 64 of 128 cells are real squares', () => {
    expect(SQUARES).toHaveLength(64);
    let count = 0;
    for (let i = 0; i < 128; i++) if (onBoard(i)) count++;
    expect(count).toBe(64);
  });

  it('directions move the right way', () => {
    expect(sqName(sqIndex('e4') + NORTH)).toBe('e5');
    expect(sqName(sqIndex('e4') + SOUTH)).toBe('e3');
    expect(sqName(sqIndex('e4') + EAST)).toBe('f4');
    expect(sqName(sqIndex('e4') + WEST)).toBe('d4');
  });

  it('detects stepping off every edge', () => {
    expect(onBoard(sqIndex('h4') + EAST)).toBe(false);
    expect(onBoard(sqIndex('a4') + WEST)).toBe(false);
    expect(onBoard(sqIndex('e8') + NORTH)).toBe(false);
    expect(onBoard(sqIndex('e1') + SOUTH)).toBe(false);
  });

  it('rejects non-integers and out-of-range numbers', () => {
    expect(onBoard(1.5)).toBe(false);
    expect(onBoard(1000)).toBe(false);
  });
});

describe('board contents', () => {
  it('empty board has no pieces', () => {
    const b = emptyBoard();
    expect(b).toHaveLength(128);
    expect(SQUARES.every((i) => pieceAt(b, i) === null)).toBe(true);
  });

  it('withPiece returns a new board and leaves the original unchanged', () => {
    const b0 = emptyBoard();
    const b1 = withPiece(b0, sqIndex('e4'), W('p'));
    expect(pieceAt(b1, sqIndex('e4'))).toEqual(W('p'));
    expect(pieceAt(b0, sqIndex('e4'))).toBeNull();
  });

  it('cloneBoard is independent of the original', () => {
    const b0 = withPiece(emptyBoard(), sqIndex('a1'), W('r'));
    const b1 = cloneBoard(b0);
    b1[sqIndex('a1')] = null;
    expect(pieceAt(b0, sqIndex('a1'))).toEqual(W('r'));
  });

  it('pieceAt returns null off the board', () => {
    expect(pieceAt(emptyBoard(), 8)).toBeNull();
    expect(pieceAt(emptyBoard(), -16)).toBeNull();
  });

  it('findSquares and findKing', () => {
    let b = emptyBoard();
    b = withPiece(b, sqIndex('b1'), W('n'));
    b = withPiece(b, sqIndex('g1'), W('n'));
    b = withPiece(b, sqIndex('e1'), W('k'));
    b = withPiece(b, sqIndex('e8'), B('k'));
    expect(findSquares(b, (p) => p.type === 'n' && p.color === 'w').map(sqName)).toEqual(['b1', 'g1']);
    expect(sqName(findKing(b, 'w'))).toBe('e1');
    expect(sqName(findKing(b, 'b'))).toBe('e8');
    expect(findKing(emptyBoard(), 'w')).toBe(-1);
  });
});

describe('printBoard', () => {
  it('draws rank 8 on top, White uppercase', () => {
    let b = emptyBoard();
    b = withPiece(b, sqIndex('a8'), B('r'));
    b = withPiece(b, sqIndex('e1'), W('k'));
    const lines = printBoard(b, false).split('\n');
    expect(lines[0]).toBe('8 r . . . . . . .');
    expect(lines[7]).toBe('1 . . . . K . . .');
    expect(lines[8]).toBe('  a b c d e f g h');
  });
});
