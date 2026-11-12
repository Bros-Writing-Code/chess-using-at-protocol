# AT Protocol Integration

Author: James Keys

- [Lexicon options](lexicon-options.md)
- OAuth (TODO)

## Lexicon

### [Game](./lexicons/app/chess/game.json)

`app.chess.game` is a mutable record with a TID key. It represents an invitation when `challenge` is absent, or an acceptance when present. The owner updates the same record after a move or resignation.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `opponent` | DID string | Yes | The opposing player's DID; the record owner's DID comes from their repository. |
| `color` | String: `white` or `black` | Yes | The record owner's color. |
| `challenge` | `com.atproto.repo.strongRef` | No | Reference to the challenger's game record and its CID at acceptance. Present only on the accepting player's record and retained on later updates. |
| `pgn` | String | Yes | Full mainline move history from the standard starting position. May be empty before the first move; maximum 262,144 UTF-8 bytes. Clients must replay and validate the moves. |
| `fen` | String | Yes | Six-field position after replaying `pgn`, or the standard starting position before any moves. Must be 1–256 UTF-8 bytes. Clients must validate it against the replayed position. |
| `status` | String: `active` or `resigned` | Yes | Whether the record owner has resigned. Checkmate and automatic draws are derived from the accepted history by the engine. |

### [Reject](./lexicons/app/chess/reject.json)

`app.chess.reject` is a record with a TID key that requests a correction to a specific version of an opponent's game record. A rejection does not end the game or replace the last accepted state.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `subject` | `com.atproto.repo.strongRef` | Yes | The opponent's game record URI and the CID of the exact offending update, not just its latest version. |
| `reason` | Nonempty string | Yes | A reason code. The known values below are nonexhaustive; other nonempty strings are also valid. |
| `message` | String | No | Human-readable explanation, limited to 200 grapheme clusters and 2,000 UTF-8 bytes. Treat as untrusted plain text, not markup or instructions. |

| Known reason | Meaning |
| --- | --- |
| `wrongTurn` | The opponent moved out of turn. |
| `badPrev` | The move history does not extend the last accepted history by exactly one ply. |
| `illegalMove` | The appended move is illegal. |
| `badFEN` | The supplied FEN differs from the position computed from PGN. |

## Lexicon Tests

Run the tests with `npm test -- src/atproto/testing/lexicons.test.js`

[lexicons.test.js](./testing/lexicons.test.js) uses Vitest to run 55 Lexicon tests (counting each `.each(...)` case separately). They fall into the following general categories:

- ensuring that the Lexicon schemas are valid and tolerant to future additional fields/unknown rejection codes.
- ensuring that the game records handle standard variants (like starting challenge with no challenge reference), and standard use cases (valid move update, challenge response, resignation)
- ensuring that the game records fail validation on missing required fields or string fields that are too long
- ensuring that the reject records handle standard known reason variants and optional message
- ensuring that the reject record message field bounds apply correctly
- ensuring that the strong reference fields in the two records (`game.challenge` and `reject.subject`) fail validation if the reference object is invalid (missing a URI/CID or those fields are malformed)

These tests exist to check record structure. They don't verify anything that has to do with chess rules. In fact, one test ensures that a record passes the validator even if the PGN or FEN is invalid. That's the engine's responsibility.
