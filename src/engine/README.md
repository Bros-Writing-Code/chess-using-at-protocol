# chess engine

keanu
chris
russel

## moveGenerator

All seven functions take a `GameState` and a starting `Square` (`{ row, col }`).

| Function | Output | Purpose |
| --- | --- | --- |
| `moveGenerator(state, selectedSquare)` | `Square[]` | Selects the current player's piece and returns legal target squares, excluding moves that leave its king in check. |
| `getPossibleMovesPawn(state, square)` | `Square[]` | Returns candidate pawn moves, including captures and en passant. |
| `getPossibleMovesBishop(state, square)` | `Square[]` | Returns candidate diagonal moves. |
| `getPossibleMovesKnight(state, square)` | `Square[]` | Returns candidate knight jumps. |
| `getPossibleMovesRook(state, square)` | `Square[]` | Returns candidate horizontal and vertical moves. |
| `getPossibleMovesQueen(state, square)` | `Square[]` | Returns candidate diagonal, horizontal, and vertical moves. |
| `getPossibleMovesKing(state, square)` | `Square[]` | Returns candidate king moves, including castling when its conditions are met. |

The six `getPossibleMoves...` functions do not filter out moves that leave the player's king in check. Use `moveGenerator` for legal moves, such as UI move highlighting.

## gameState

These three functions are exported from `gameState.js`.

| Function | Output | Purpose |
| --- | --- | --- |
| `isInCheck(state)` | `boolean` | Returns whether the side to move's king is attacked. |
| `getGameStatus(state)` | `{ status, winner, drawReason }` | Returns `active`, `checkmate`, or `stalemate` status for the current position. Other draw rules are handled separately. |
| `applyMove(state, uci)` | `Result<GameState>`: `{ ok: true, value: newState }` or `{ ok: false, error: string }` | Validates and applies a UCI move without changing `state`; updates the board, turn, special-move fields, history, and game status. |
