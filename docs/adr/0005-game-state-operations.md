# ADR 0005: Game state evaluation and move application

- **Status:** Proposed
- **Date:** 2026-11-13
- **Scope:** Engine game-state operations in `src/engine/gameState.js`

## Context

Move generation identifies legal destination squares, but callers also need to know whether the current player is in check, whether the game has ended, and how a valid UCI move changes the complete `GameState`.

## Decision

Expose three functions:

| Function | Output | Purpose |
| --- | --- | --- |
| `isInCheck(state)` | `boolean` | Tests whether the side to move's king is attacked. |
| `getGameStatus(state)` | `{ status, winner, drawReason }` | Returns `active`, `checkmate`, or `stalemate` based on check and available legal moves. |
| `applyMove(state, uci)` | `Result<GameState>` | Rejects invalid moves or returns a new state after applying a legal move. |

`applyMove` validates the UCI move and turn, handles castling, en passant, and required promotion, then updates the board, castling rights, en passant target, clocks, histories, and game status. It does not mutate the input state.

## Consequences

- UI and network code can use one move operation and receive an explicit success or error result.
- Checkmate and stalemate are available immediately after each move.
- Other draw rules, including repetition and the fifty-move rule, remain separate work; `positionHistory` records position keys for future repetition detection.
