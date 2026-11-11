# ADR 0003: Functional chess engine architecture over piece subclasses

- **Status:** Proposed
- **Date:** 2026-11-07
- **Deciders:** Engine team (Keanu, Russel, Congke)
- **Related:** ADR 0002 – Chess board representation using 0x88 indexing

## Terminology

| Term | Meaning |
| :--- | :--- |
| **Functional approach** | An architecture that represents game data using plain objects and implements behavior through separate functions rather than methods belonging to individual pieces. |
| **Object-oriented approach** | An architecture that represents pieces as class instances, with behavior implemented through methods. |
| **Inheritance** | A mechanism where subclasses inherit properties and methods from a parent class. |
| **Move generation** | The process of determining which moves a piece can make from a given position. |
| **Move validation** | The process of determining whether a move satisfies the rules of chess, including restrictions involving check. |

## Context

The chess engine needs to represent six different piece types, each with its own movement rules, while supporting shared operations such as move validation, check detection, and updating the game state.

Two main approaches were considered:

1. **Object-oriented architecture:** Define a base `Piece` class and subclasses such as `Pawn`, `Bishop`, and `Rook`. Each subclass implements its own `getPossibleMoves()` method.
2. **Functional architecture:** Represent pieces as plain objects containing their color and type. Separate functions implement movement rules and other engine operations.

The engine must satisfy several requirements:

1. **Support different movement rules.** Each piece type has unique movement patterns, but many rules and operations are shared.
2. **Centralize game state.** Move generation and validation depend on the complete board, current turn, castling rights, and other information beyond an individual piece.
3. **Support efficient move generation.** The engine must generate moves repeatedly for move validation, check detection, and other operations.
4. **Remain modular.** Team members should be able to implement and test different components without tightly coupling them together.
5. **Avoid unnecessary complexity.** The engine should be straightforward to maintain, debug, and extend.

Because the engine uses a 0x88 board representation, piece movement can be implemented using fixed offsets and shared boundary-checking logic.

## Decision

We use a **functional architecture with plain piece objects and separate move-generation functions**, rather than a class hierarchy with individual piece subclasses.

Each piece stores only the information needed to identify it. Its behavior is determined by functions that operate on the piece and the current `GameState`.

### Piece representation

Pieces are represented using a common data structure:

```js
/**
 * @typedef {Object} Piece
 * @property {'w'|'b'} color
 * @property {'p'|'r'|'n'|'b'|'q'|'k'} type
 */
```

For example:

```js
const whitePawn = {
    color: 'w',
    type: 'p'
};

const blackBishop = {
    color: 'b',
    type: 'b'
};
```

Unlike a class-based implementation, these objects do not contain movement methods or references to the game engine.

The `GameState` stores the pieces in the 0x88 board array, with each valid index containing a `Piece` object or `null`.

### Move generation

A central `moveGenerator()` function dispatches to the appropriate movement function based on the piece's type.

```js
function moveGenerator(state, piece) {
    switch (piece.type) {
        case 'p':
            return getPossibleMovesPawn(state, piece);
        case 'n':
            return getPossibleMovesKnight(state, piece);
        case 'b':
            return getPossibleMovesBishop(state, piece);
        case 'r':
            return getPossibleMovesRook(state, piece);
        case 'q':
            return getPossibleMovesQueen(state, piece);
        case 'k':
            return getPossibleMovesKing(state, piece);
    }
}
```

Each piece type has its own function:

```js
getPossibleMovesPawn(state, piece)
getPossibleMovesBishop(state, piece)
getPossibleMovesKnight(state, piece)
getPossibleMovesRook(state, piece)
getPossibleMovesQueen(state, piece)
getPossibleMovesKing(state, piece)
```

These functions use the current game state to determine possible moves.

The implementation can reuse shared helpers for movement patterns, particularly for sliding pieces such as bishops, rooks, and queens.

The exact function signatures and return types will be finalized during implementation.

### Shared rule enforcement

Rules that affect multiple piece types are implemented as separate functions rather than duplicated across piece subclasses.

Examples include:

```js
isLegalMove(move, state)
isSquareAttacked(square, color)
isCheck(state, color)
isStalemate(state)
isCheckmate(state)
applyMove(state, move)
```

This separates piece-specific movement rules from broader chess rules.

For example, a bishop's movement function determines which diagonal squares it can reach, while the legality-checking logic ensures that moving the bishop does not leave its own king in check.

Special rules such as castling, en passant, and promotion are handled by the appropriate move-generation and game-state functions.

### Separation of data and behavior

The architecture separates three main responsibilities:

| Component | Responsibility |
| :--- | :--- |
| `types.js` | Defines shared data structures such as `Piece`, `Move`, `Square`, and `GameState`. |
| `moveGeneration.js` | Implements piece-specific movement rules and move generation. |
| Game-state and rules functions | Validate moves, detect check and game-ending conditions, and update the game state. |

Functions operate on the shared `GameState` structure rather than maintaining separate state inside individual piece objects.

This also supports the AT Protocol architecture, where moves are received, validated, and applied to a locally maintained game state.

### Performance considerations

The functional approach avoids creating separate class instances with piece-specific behavior and allows the move generator to dispatch using a piece's type.

Combined with 0x88 indexing, movement functions can use fixed offsets and direct array access.

However, the functional approach is not inherently faster than classes. JavaScript engines can optimize both method calls and function calls, and performance depends on the actual implementation.

The decision prioritizes simpler data representation and move-generation logic. Any performance improvements should be verified through testing rather than assumed.

## Consequences

**Positive**

- Pieces use a simple, consistent data structure without requiring six subclasses and a shared superclass.
- Movement behavior is separated from piece data, reducing dependencies between the board representation and move-generation logic.
- Shared chess rules can be implemented centrally rather than repeated across piece classes.
- Movement functions can reuse common helpers, particularly for sliding pieces.
- Individual functions can be tested using constructed game states without needing to instantiate a hierarchy of piece objects.
- Plain objects are straightforward to inspect, copy, and reconstruct when loading a game from FEN.
- The architecture supports parallel development because piece movement, rule validation, and game-state operations have clearly defined responsibilities.

**Negative / trade-offs**

- The central move generator requires explicit dispatch based on piece type, rather than relying on polymorphic method calls.
- Adding a new piece type would require updating the dispatch logic and implementing its movement function.
- Functions that operate on pieces must receive the relevant game state explicitly rather than accessing it through an object reference.
- Separating behavior from data can make it less immediately obvious where a piece's behavior is implemented.
- A functional architecture does not automatically guarantee immutability or the absence of side effects. Functions such as `applyMove()` must have clearly documented state-modification behavior.

## Alternatives considered

| Alternative | Why rejected |
| :--- | :--- |
| **Base `Piece` class with six subclasses** | Provides a natural object-oriented model and polymorphic movement methods, but introduces a class hierarchy that is unnecessary for the engine's relatively small and fixed set of piece types. |
| **Single `Piece` class with movement methods** | Avoids subclasses but still couples piece data and movement behavior. A type-based dispatch would likely still be required inside the class. |
| **Separate board or engine class managing piece objects** | Can encapsulate game state and rules, but introduces additional object-oriented structure without a clear benefit for the planned implementation. |
| **Move lookup tables for every piece type** | Could reduce repeated movement calculations, but introduces additional complexity and potentially larger lookup structures. May be considered later if performance testing identifies move generation as a bottleneck. |

## Open questions

- Whether piece movement functions should return pseudo-legal moves or only fully legal moves that cannot leave the king in check.
- Whether `applyMove()` should mutate the existing `GameState` or return a new state.
- Whether shared sliding-piece movement should use a common helper function or remain implemented separately for each piece type.
- Whether `moveGenerator()` should accept a `Piece` object, a `Square`, or both.
- Whether performance benchmarks should compare the functional implementation against a class-based alternative.
