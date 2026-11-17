// @ts-check
/**
 * index.js — the engine's public API. Other teams import ONLY from here:
 *
 *   import { createGame, toGrid, legalMovesFrom, applyMove } from '../engine/index.js';
 *
 * Contract: every function is pure. It takes data and returns new data,
 * never mutates its input, and never stores a game. The caller owns every
 * GameState. Squares are {row, col} with row 0 = rank 8 and col 0 = file a;
 * 0x88 indexes stay inside the engine.
 */

// Setting up and reading a game
export {
  START_FEN,
  createGame,
  getPiece,
  toGrid,
  replayMoves,
} from './game.js';

// Moves
export { legalMovesFrom, legalMoves, isValidMove } from './game.js';
export { applyMove } from './gameState.js';

// Game status
export { isInCheck, getGameStatus } from './gameState.js';

// Notation
// To load a position from a FEN, use createGame(fen): it also sets the status.
export { GameStatetoFEN, moveToUCI, UCItoMove } from './notation.js';

// Debugging only: printBoard(state.board) prints an ASCII board
export { printBoard } from './0x88helper.js';
