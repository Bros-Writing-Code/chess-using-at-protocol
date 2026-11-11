# ADR 0002: Chess board representation using 0x88 indexing

- **Status:** Proposed
- **Date:** 2026-11-07
- **Deciders:** Engine team (Keanu, Russel, Congke)
- **Related:** Chess engine architecture and move generation

## Terminology

| Term | Meaning |
| :--- | :--- |
| **0x88 representation** | A chess board representation using a 128-element array, where 64 indices correspond to valid board squares and the remaining 64 are invalid. |
| **Board state** | The positions and types of pieces currently on the board. |
| **Piece** | An object containing a piece's color and type, such as `{ color: 'w', type: 'p' }`. |
| **Square** | A board position represented by a row and column, or internally by a 0x88 index. |
| **Off-board detection** | A bitwise check `(index & 0x88) !== 0` that determines whether an index is outside the valid chess board. |

## Context

The chess engine needs an internal representation of the board that supports piece movement, move validation, and game state updates.

The engine must be able to:

1. **Track piece positions.** Each square must contain either a piece or an indication that it is empty.
2. **Generate possible moves efficiently.** Movement calculations should be simple for all six piece types, particularly sliding pieces such as bishops, rooks, and queens.
3. **Detect board boundaries.** Move generation must identify when a piece moves outside the board without requiring separate row and column checks.
4. **Support game state operations.** The representation must work with `applyMove()`, `isLegalMove()`, and the other engine functions.
5. **Support FEN conversion.** The engine must be able to serialize and deserialize the board for communication through AT Protocol records.

A conventional 8×8 array would represent the board naturally, but movement calculations would require checking row and column boundaries separately.

We considered the 0x88 representation as an alternative that simplifies movement calculations and boundary detection.

## Decision

We use a **128-element array indexed using the 0x88 representation** to store the chess board. Each valid square contains either a `Piece` object or `null` if the square is empty.

This array is stored as part of the internal `GameState` object. It is not sent directly over AT Protocol; FEN remains the serialized representation of game state.

### Board representation

The 0x88 format uses a 16×8 indexing scheme. Each rank occupies 16 indices, but only the first 8 indices of each rank represent valid squares.

| Rank | Valid indices | Invalid indices |
| :--- | :--- | :--- |
| 8 | `0x70`–`0x77` | `0x78`–`0x7F` |
| 7 | `0x60`–`0x67` | `0x68`–`0x6F` |
| 6 | `0x50`–`0x57` | `0x58`–`0x5F` |
| 5 | `0x40`–`0x47` | `0x48`–`0x4F` |
| 4 | `0x30`–`0x37` | `0x38`–`0x3F` |
| 3 | `0x20`–`0x27` | `0x28`–`0x2F` |
| 2 | `0x10`–`0x17` | `0x18`–`0x1F` |
| 1 | `0x00`–`0x07` | `0x08`–`0x0F` |

The array contains 128 entries, but only 64 represent actual chess squares. Invalid entries are unused and should not contain pieces.

### Piece storage

Each valid index stores either a `Piece` object or `null`.

```js
/**
 * @typedef {Object} Piece
 * @property {'w'|'b'} color
 * @property {'p'|'r'|'n'|'b'|'q'|'k'} type
 */

/** @type {(Piece|null)[]} */
const pieces = Array(128).fill(null);
```

For example, a white pawn on e2 is stored at index `0x14`:

```js
pieces[0x14] = {
    color: 'w',
    type: 'p'
};
```

An empty square is represented by `null`.

### Square indexing

A square's 0x88 index is calculated using:

```js
index = row * 16 + col;
```

Where `row` ranges from 0 to 7 (rank 1 to rank 8), and `col` ranges from 0 to 7 (file a to file h).

The row and column can be recovered using:

```js
row = index >> 4;
col = index & 7;
```

This allows the engine to convert between the external `Square` type and internal array indices.

### Boundary detection

The primary advantage of 0x88 indexing is that invalid squares can be detected with a single bitwise operation:

```js
function isOnBoard(index) {
    return (index & 0x88) === 0;
}
```

For example:

- `0x24` (e3) is valid.
- `0x28` is invalid because it lies beyond the h-file.
- `0x80` is invalid because it lies beyond the eighth rank.

This eliminates the need for separate row and column boundary checks during move generation.

### Move generation

Pieces can generate moves using fixed index offsets.

| Piece | Movement offsets |
| :--- | :--- |
| Knight | `±31`, `±33`, `±14`, `±18` |
| Bishop | `±15`, `±17` |
| Rook | `±1`, `±16` |
| Queen | Bishop and rook offsets |
| King | `±1`, `±15`, `±16`, `±17` |
| Pawn | `±16` forward, `±15` and `±17` for captures, depending on color |

Sliding pieces repeatedly add an offset until they encounter an occupied square or an invalid index.

For example, a rook moving horizontally can increment its index by `1` until it encounters another piece or `(index & 0x88) !== 0`.

The move generator uses these offsets to determine potential destinations. Additional rules, including check, castling, en passant, and promotion, are handled by the appropriate move generation and validation functions.

### Integration with GameState

The board array is stored inside the `GameState` object alongside the other information required to enforce chess rules.

```js
/**
 * @typedef {Object} GameState
 * @property {(Piece|null)[]} pieces
 * @property {'w'|'b'} currentTurn
 * @property {CastlingRights} castlingRights
 * @property {Square|null} enPassantTarget
 * @property {number} halfmoveClock
 * @property {number} fullmoveNumber
 * @property {Move[]} moveHistory
 */
```

The 0x88 representation is an internal implementation detail. `GameStatetoFEN()` and `FENtoGameState()` convert between this representation and the standard FEN format used by the AT Protocol layer.

## Consequences

**Positive**

- Board boundary detection requires only one bitwise operation.
- Move generation is simplified by using fixed offsets rather than separate row and column calculations.
- Sliding pieces can use the same general movement logic with different offsets.
- A single array provides direct access to the piece occupying any valid square.
- The representation is independent of the network format and can be changed without affecting stored AT Protocol records.

**Negative / trade-offs**

- The array allocates 128 entries despite only 64 representing valid squares. This additional memory usage is accepted because the board is small.
- 0x88 indexing is less intuitive than a conventional 8×8 array and requires developers to understand the indexing scheme.
- Converting between row/column coordinates, algebraic notation, and 0x88 indices requires additional logic.
- Invalid indices must never be treated as playable squares. Move generation and board updates must consistently enforce boundary checks.
- The performance advantage over a conventional 8×8 array is not guaranteed in JavaScript and depends on the implementation.

## Alternatives considered

| Alternative | Why rejected |
| :--- | :--- |
| **8×8 nested array** | More intuitive and directly represents the board, but move generation requires separate row and column boundary checks. |
| **64-element flat array** | Uses less memory and supports direct indexing, but movement offsets alone cannot detect horizontal wraparound. Additional boundary checks are needed. |
| **Piece list only** | Stores only active pieces, but checking whether a square is occupied requires searching the list or maintaining an additional lookup structure. We also considered having each `Piece` object store its own position, but this would duplicate position information already represented by the board array and require keeping both synchronized. |

## Open questions

- Whether `Square` objects should remain the public interface for engine functions or whether internal functions should accept 0x88 indices directly.
- Whether move generation should return destination squares or complete `Move` objects, particularly for promotions, castling, and en passant.
- Whether `applyMove()` should modify the existing `GameState` or return a new state.
