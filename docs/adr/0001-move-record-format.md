# ADR 0001: Move record format on ATproto (UCI + FEN)

- **Status:** Proposed
- **Date:** 2026-11-06
- **Deciders:** Engine team (Keanu, Russel, Congke), AT team
- **Related:** Gate 0 – "move JSON agreed with AT team"

## Terminology

| Term | Meaning | Where it appears |
|---|---|---|
| **Board state** | Only where each piece is: what a spectator sees looking at the board. No turn, castling or other rule information. | **Field 1 of a FEN** (piece placement), e.g. `rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR` |
| **Game state** | Board state **plus** everything the rules need that can't be seen on the board: side to move, castling rights, en passant square, halfmove clock, fullmove number. | **All 6 fields of a FEN** (`fenAfter`), e.g. `rnbqkbnr/…/RNBQKBNR b KQkq e3 0 1` |
| **Full game history** | Game state plus every earlier position, needed for threefold repetition. | Not in any single record: rebuilt from the **list of move records**. |
| **`GameState` (engine type)** | The engine's internal object holding the game state + history. Never sent over the network. | Engine code only (`types.ts`) |

Why board state alone isn't enough: the same piece placement can be white's or black's turn, with or without castling rights (a king that moved and returned looks identical), and with or without an en passant capture available. Rules depend on all of these, so records carry the full game state (FEN), not just the board.

```
rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR  b  KQkq  e3  0  1
└──────────────── board state ───────────────┘ └────── rule info ──────┘
└─────────────────────── game state (fenAfter) ────────────────────────┘
```

## Context

Each player's browser runs its own copy of the chess engine. There is no game server: moves travel as records in each player's own repository on their PDS, and the opponent's client reads them.

We need to decide what a client publishes when a player makes a move. Requirements:

1. **Each client is the referee.** The receiver must be able to check that a move is legal, not trust the sender.
2. **Reload and join.** A client must be able to restore a game after a refresh, or open a game in progress.
3. **Detect desync.** If two clients disagree about the position (bug, old version, missed record), we should notice immediately.
4. **Stable network format.** Internal engine types (`GameState`) will change during development; saved games and the AT team's code must not break when they do.
5. **Small records.** Records are written on every move and stored permanently.

The option first proposed was `submitMove(gameState)`, which publishes the full internal `GameState` after each move.

## Decision

We publish **one game record** when a game is created, and **one move record per move**. A move record contains the **action** (UCI move) and the **resulting game state** as a FEN (`fenAfter`), which also serves as a checksum. The board state is the first field of that FEN. The internal `GameState` object is never sent over the network.

### Game record (created once)

```json
{
  "$type": "app.chess.game",
  "white": "did:plc:alice...",
  "black": "did:plc:bob...",
  "startFen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "timeControl": { "initialSeconds": 600, "incrementSeconds": 0 },
  "createdAt": "2026-11-06T19:00:00Z"
}
```

### Move record (one per move)

```json
{
  "$type": "app.chess.move",
  "game": "at://did:plc:alice.../app.chess.game/3k2x",
  "uci": "e2e4",
  "fenAfter": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
  "createdAt": "2026-11-06T19:00:12Z"
}
```

| Field | Type | Why it is needed |
|---|---|---|
| `game` | AT-URI | Identifies which game the move belongs to; a player can have several games at once. Used to fetch all moves of a game. |
| `uci` | string, `^[a-h][1-8][a-h][1-8][qrbn]?$` | The move itself (from, to, optional promotion). The receiver runs `applyMove` on it and **rejects illegal moves**. Short and never changes format. |
| `fenAfter` | string (FEN, 6 fields) | The **game state** after the move: **board state** (field 1, piece placement) plus side to move, castling, en passant, halfmove clock and fullmove number. Used as a **checksum** (receiver compares with its own `toFEN()`), for **fast reload** from the latest position, and for spectators, who can render the board from field 1 alone. |
| `createdAt` | datetime | Clocks and timeouts, ordering, and display in the move list. |

`ply` (half-move index) is **not stored**: it is derived from `fenAfter`, adjusted by the game's `startFen`:

```
plies(fen) = 2 × (fullmove − 1) + (sideToMove === 'b' ? 1 : 0)
ply of a move = plies(fenAfter) − plies(startFen)
```

### Client flow

**Sending**
1. Player makes a move in the UI.
2. `applyMove(state, uci)` → new state, or an error (move is not sent).
3. Publish `{ game, uci, fenAfter: toFEN(newState), createdAt }`.

**Receiving**
1. Read the opponent's new move record.
2. `applyMove(state, record.uci)`. If illegal → reject and flag the game.
3. Compare `toFEN(newState)` with `record.fenAfter`. If different → desync; show an error and resync from the records.

**Reloading**
- Fetch the game record and all move records, sort by ply, replay from `startFen`.
- Shortcut: load the latest `fenAfter` directly (game state is correct, but threefold-repetition history requires the replay).
- Spectators: read the latest `fenAfter` and draw the board from its first field (board state).

## Consequences

**Positive**
- Every move is validated by the receiver; a client cannot inject an illegal position.
- Desync is detected on the first mismatched move.
- The network format is independent of internal types; `GameState` can change freely.
- Records are small (about 100 bytes per move) and readable by any chess tool (UCI and FEN are standards).
- The list of move records is a complete game record (convertible to PGN).

**Negative / trade-offs**
- `fenAfter` is redundant with `uci` (about 60 extra characters per move). Accepted for desync detection and fast reload.
- Threefold-repetition detection needs the full move history, not just the latest FEN, so a full replay is required for draw rules.
- Both clients must use the same FEN rules (e.g. when to write an en passant square). Engine tests must cover `toFEN` output exactly.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| **`submitMove(gameState)`**: publish the full internal `GameState` | Receiver can't easily validate (would have to diff states to infer the move); allows injecting any position; couples the network format to internal types (any field change breaks saved games and the AT team's code); large and growing records. |
| **UCI only** (no `fenAfter`) | Works if every client is bug-free, but desync is silent and reload always requires a full replay. Kept as a fallback: `fenAfter` is a check, `uci` is the source of truth. |
| **FEN only** (no move) | Receiver can't easily tell which move was played or whether it was legal. |
| **SAN** (`Nf3`, `exd5`) instead of UCI | Needs the position to parse, is ambiguous without disambiguation rules, and is harder to generate correctly. UCI is simpler for machines; SAN can be generated for display. |
| **Storing `ply` / `moveNumber` explicitly** | Redundant with `fenAfter`. Can be added later if sorting without parsing becomes a performance issue. |

## Open questions (for the AT team)

- Final lexicon NSIDs (`app.chess.game`, `app.chess.move` are placeholders).
- How resign, draw offers and game end are recorded (separate record types or a `type` field).
- Polling vs. firehose subscription for receiving moves.
