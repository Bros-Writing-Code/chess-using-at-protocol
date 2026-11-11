import { describe, it, expect } from 'vitest';
import { createGame } from '../game.js';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4_PLACEMENT = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR';
const STALEMATE_FEN = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1';
const INSUFFICIENT_FEN = '8/8/8/8/8/5k2/8/5K2 w - - 0 1';
const FIFTY_MOVE_FEN = 'k7/8/8/8/8/8/8/K6R w - - 100 80';
const PROMOTION_FEN = '8/P6k/8/8/8/8/8/K7 w - - 0 1';

const FOOLS_MATE = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];
const KNIGHT_SHUFFLE = [
  'g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8',
];
const CHECK_NOT_MATE = ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'h5f7'];

function playAll(game, moves) {
  moves.forEach((uci) => game.move(uci));
}

describe('createGame', () => {
  it('has 20 legal moves at the start', () => {
    const game = createGame();
    const moveCount = [...game.legalMoves().values()].flat().length;
    expect(moveCount).toBe(20);
    expect(game.legalMoves().get('e2')).toEqual(['e3', 'e4']);
    expect(game.turn()).toBe('white');
  });

  it('updates the FEN after a legal move', () => {
    const game = createGame();
    const result = game.move('e2e4');
    expect(result.ok).toBe(true);
    expect(result.value).toBe(game.fen());
    expect(game.fen().split(' ')[0]).toBe(AFTER_E4_PLACEMENT);
    expect(game.turn()).toBe('black');
  });

  it('rejects an illegal move and changes nothing', () => {
    const game = createGame();
    const result = game.move('e2e5');
    expect(result.ok).toBe(false);
    expect(result.error).toEqual(expect.any(String));
    expect(game.fen()).toBe(START_FEN);
  });

  it('promotes to a queen when no letter is given', () => {
    const game = createGame(PROMOTION_FEN);
    game.move('a7a8');
    expect(game.fen().startsWith('Q7/')).toBe(true);
  });

  it('lists each promotion square once', () => {
    const game = createGame(PROMOTION_FEN);
    expect(game.legalMoves().get('a7')).toEqual(['a8']);
  });

  it('reports an active game', () => {
    expect(createGame().status()).toEqual({
      status: 'active',
      winner: null,
      drawReason: null,
      inCheck: false,
    });
  });

  it('reports check without ending the game', () => {
    const game = createGame();
    playAll(game, CHECK_NOT_MATE);
    expect(game.status()).toEqual({
      status: 'active',
      winner: null,
      drawReason: null,
      inCheck: true,
    });
  });

  it('reports checkmate with the winner', () => {
    const game = createGame();
    playAll(game, FOOLS_MATE);
    expect(game.status()).toEqual({
      status: 'checkmate',
      winner: 'black',
      drawReason: null,
      inCheck: true,
    });
  });

  it('reports stalemate', () => {
    expect(createGame(STALEMATE_FEN).status()).toEqual({
      status: 'stalemate',
      winner: null,
      drawReason: 'stalemate',
      inCheck: false,
    });
  });

  it('reports a draw by insufficient material', () => {
    expect(createGame(INSUFFICIENT_FEN).status()).toEqual({
      status: 'draw',
      winner: null,
      drawReason: 'insufficient-material',
      inCheck: false,
    });
  });

  it('reports a draw by the fifty-move rule', () => {
    expect(createGame(FIFTY_MOVE_FEN).status()).toEqual({
      status: 'draw',
      winner: null,
      drawReason: 'fifty-move-rule',
      inCheck: false,
    });
  });

  it('reports a draw by threefold repetition', () => {
    const game = createGame();
    playAll(game, KNIGHT_SHUFFLE);
    expect(game.status()).toEqual({
      status: 'draw',
      winner: null,
      drawReason: 'threefold-repetition',
      inCheck: false,
    });
  });
});
