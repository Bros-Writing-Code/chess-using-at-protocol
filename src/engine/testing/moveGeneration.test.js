// @ts-check
import { describe, it, expect } from 'vitest';
import { sqIndex, toIndex, emptyBoard, withPiece } from '../0x88helper.js';
import { moveGenerator } from '../moveGeneration.js';

const W = (type) => ({ type, color: 'w' });
const B = (type) => ({ type, color: 'b' });
const withKings = (board) => withPiece(
  withPiece(board, sqIndex('a1'), W('k')),
  sqIndex('h8'), B('k')
);

const createMockState = (board, enPassantTarget = null) => ({
  board,
  currentTurn: 'w',
  enPassantTarget,
  castlingRights: {
    wKingside: false,
    wQueenside: false,
    bKingside: false,
    bQueenside: false
  }
});

describe('Chess Engine 0x88 Move Generation Suite', () => {

  it('calculates sliding rays accurately for an isolated Rook on an open board', () => {
    let board = emptyBoard();
    const d5Index = sqIndex('d5');
    board = withPiece(board, d5Index, W('r'));

    const state = createMockState(withKings(board));
    const selectedSquare = { row: 3, col: 3 };
    const legalTargets = moveGenerator(state, selectedSquare);

    expect(legalTargets).toHaveLength(14);
  });

  it('handles blocked paths and enemy captures for sliding pieces', () => {
    let board = emptyBoard();
    board = withPiece(board, sqIndex('d5'), W('r'));
    board = withPiece(board, sqIndex('d7'), W('p'));
    board = withPiece(board, sqIndex('d3'), B('n'));

    const state = createMockState(withKings(board));
    const legalTargets = moveGenerator(state, { row: 3, col: 3 });
    const targetIndices = legalTargets.map(sq => toIndex(sq.row, sq.col));

    expect(targetIndices).toContain(sqIndex('d3'));
    expect(targetIndices).not.toContain(sqIndex('d7'));
    expect(targetIndices).not.toContain(sqIndex('d8'));
  });

  it('calculates fixed-offset steps for Knights avoiding friendly pieces', () => {
    let board = emptyBoard();
    board = withPiece(board, sqIndex('b1'), W('n'));
    board = withPiece(board, sqIndex('d2'), W('p'));

    const state = createMockState(withKings(board));
    const legalTargets = moveGenerator(state, { row: 7, col: 1 });
    const targetIndices = legalTargets.map(sq => toIndex(sq.row, sq.col));

    expect(targetIndices).toContain(sqIndex('a3'));
    expect(targetIndices).toContain(sqIndex('c3'));
    expect(targetIndices).not.toContain(sqIndex('d2'));
  });

  it('respects basic en passant options when the engine matches targets', () => {
    let board = emptyBoard();
    board = withPiece(board, sqIndex('e5'), W('p'));
    board = withPiece(board, sqIndex('d5'), B('p'));
    board = withPiece(board, sqIndex('e1'), W('k'));
    board = withPiece(board, sqIndex('e8'), B('k'));

    const state = createMockState(board, sqIndex('d6'));
    const legalTargets = moveGenerator(state, { row: 3, col: 4 }); // e5
    const targetIndices = legalTargets.map(sq => toIndex(sq.row, sq.col));

    expect(targetIndices).toContain(sqIndex('d6'));
  });

  it('filters out moves that would leave the own King in check', () => {
    let board = emptyBoard();
    board = withPiece(board, sqIndex('e1'), W('k'));
    board = withPiece(board, sqIndex('e2'), W('n'));
    board = withPiece(board, sqIndex('e8'), B('r'));

    const state = createMockState(board);
    const legalTargets = moveGenerator(state, { row: 6, col: 4 }); // e2
    expect(legalTargets).toHaveLength(0);
  });

  it('rejects en passant when removing the captured pawn exposes the King', () => {
    let board = emptyBoard();
    board = withPiece(board, sqIndex('a5'), W('k'));
    board = withPiece(board, sqIndex('e5'), W('p'));
    board = withPiece(board, sqIndex('d5'), B('p'));
    board = withPiece(board, sqIndex('h5'), B('r'));
    board = withPiece(board, sqIndex('a8'), B('k'));

    const state = createMockState(board, sqIndex('d6'));
    const targetIndices = moveGenerator(state, { row: 3, col: 4 })
      .map(sq => toIndex(sq.row, sq.col));

    expect(targetIndices).toContain(sqIndex('e6'));
    expect(targetIndices).not.toContain(sqIndex('d6'));
  });
});
