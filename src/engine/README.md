# chess engine

keanu
chris
russel

## moveGenerator

All seven functions take a `GameState` and a starting `Square` (`{ row, col }`) and return an array of target squares (`Square[]`).

| Function | Purpose |
| --- | --- |
| `moveGenerator(state, selectedSquare)` | Selects the piece by type and returns legal target squares for the current player, including checks that the move does not leave their king in check. |
| `getPossibleMovesPawn(state, square)` | Returns candidate pawn moves, including captures and en passant. |
| `getPossibleMovesBishop(state, square)` | Returns candidate diagonal moves. |
| `getPossibleMovesKnight(state, square)` | Returns candidate knight jumps. |
| `getPossibleMovesRook(state, square)` | Returns candidate horizontal and vertical moves. |
| `getPossibleMovesQueen(state, square)` | Returns candidate diagonal, horizontal, and vertical moves. |
| `getPossibleMovesKing(state, square)` | Returns candidate king moves, including castling when its conditions are met. |

The six `getPossibleMoves...` functions do not filter out moves that leave the player's king in check. Use `moveGenerator` for legal moves, such as UI move highlighting.


## APIs
## applyMove
## getGameStatus
