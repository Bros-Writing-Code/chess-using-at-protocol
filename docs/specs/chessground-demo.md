# Chessground Demo Spec

- **Issue:** #12
- **Status:** Draft
- **Date:** 2026-11-09
- **Related:** #10 and #13 (comparison with our own board), [ADR 0004](../adr/0004-chessground-demo-testing.md) (testing)

## What we're building

A small chess page built on [chessground](https://github.com/lichess-org/chessground). Two people share one browser and play a full game against a clock.

It exists so #13 can compare chessground with our own board rendering, so it stays simple.

| Included | Left out for now |
| :--- | :--- |
| Board with White at the bottom | Resign and draw buttons |
| Legal moves highlighted, click or drag to move | Skins |
| Only legal moves allowed | Move list |
| Clock | Online play |
| Status line | Choosing a promotion piece (the engine team owns this, so pawns become queens for now) |
| New Game button | |

## What the page looks like

```
White to move            <- status line

Black   10:00
┌─────────────────┐
│                 │
│      board      │
│                 │
└─────────────────┘
White   10:00

[ New Game ]
```

## Who does what

Chessground only draws the board and handles clicks and drags. It doesn't know the rules of chess, so the rest is ours.

| File in `src/app/chessground-demo/` | Job |
| :--- | :--- |
| `index.html` | The page |
| `style.css` | Board size and layout |
| `main.js` | Connects the board, the game, the clock, and the page |
| `game.js` | The adapter. Knows the rules by using chess.js, and is the only file that imports it |
| `clock.js` | Tracks each side's time. Knows nothing about the page |
| `testing/game.test.js`, `testing/clock.test.js` | Unit tests |

**Setup:** add `@lichess-org/chessground` and `chess.js`, plus `vite` as a dev dependency. Add `npm run dev` and `npm run build`, both pointing Vite at this folder. Don't add a Vite config at the repo root, because Vitest would read it and could stop finding the engine tests.

## The adapter (`game.js`)

`createGame(startFen)` returns a game object. Leave out the FEN to start from the normal starting position. `main.js` only touches the game through these functions:

| Function | What it gives back |
| :--- | :--- |
| `game.fen()` | The current position as a FEN string |
| `game.turn()` | `'white'` or `'black'` |
| `game.legalMoves()` | A `Map` of the current player's legal moves, such as `e2 → [e3, e4]`. Chessground's `movable.dests` uses this format |
| `game.move(uci)` | Plays a move such as `e2e4`. Returns `{ ok: true, value: newFen }`, or `{ ok: false, error }` with the game unchanged |
| `game.status()` | `{ status, winner, drawReason, inCheck }` |

`status` and `drawReason` use the values already defined in `src/engine/types.js`. `winner` is `'white'`, `'black'`, or `null`.

**Promotion:** `main.js` sends moves with no promotion letter, such as `a7b8`. chess.js refuses those, so `game.js` fills in a queen.

**The game stays in memory** inside the adapter, rather than being rebuilt from a FEN each time. Threefold repetition needs earlier positions, which a FEN doesn't contain.

### Connecting the engine later

Only `game.js` changes. The tests in `testing/game.test.js` then confirm the engine behaves the same way.

| Function | Today, with chess.js | Later, with the engine |
| :--- | :--- | :--- |
| `createGame(fen)` | `new Chess(fen)` | `FENtoGameState(fen)` |
| `fen()` | `chess.fen()` | `GameStatetoFEN(state)` |
| `turn()` | `chess.turn()` | `state.currentTurn` |
| `legalMoves()` | `chess.moves({ verbose: true })` | `moveGenerator(state, square)` for each square |
| `move(uci)` | `chess.move({ from, to, promotion })` | `UCItoMove(uci)`, then `applyMove` (**not built yet**) |
| `status()` | `isCheckmate()`, `isDraw()`, and similar | `state.status`, `state.winner`, `state.drawReason`, and `isCheck` (**not built yet**) |

## The clock (`clock.js`)

**Rules**

- Each side gets 10 minutes, with no increment.
- Nothing runs until White's first move. Black's time starts after that move.
- After each move, the side that moved stops and the other side starts.
- A side that reaches 0:00 loses, and the board and clocks freeze.
- Time is worked out from timestamps, so a background tab can't make it drift.

**Functions**

| Function | What it does |
| :--- | :--- |
| `createClock({ initialSeconds, now })` | Makes a clock. `now` returns the current time in milliseconds, and tests pass a fake one |
| `clock.start(color)` | Starts counting down for `color`, and charges the time so far to the side that was running |
| `clock.stop()` | Freezes both sides |
| `clock.reset()` | Back to full time, not running |
| `clock.remaining(color)` | Milliseconds left, never below 0 |
| `clock.flagged()` | The side that ran out of time, or `null` |

`main.js` keeps the starting time in one constant, `INITIAL_SECONDS`. It redraws the times about every 100 ms and shows them as `m:ss`.

## What happens during a game

**Page load:** create a game and a clock. The board shows the starting position, White is to move, and both clocks show 10:00 and aren't running.

**When a player moves,** chessground moves the piece and calls `movable.events.after` in `main.js`, which does the following:

1. Checks the clock. If time had already run out, the timeout wins and the move is discarded.
2. Plays the move with `game.move()`.
3. Redraws the board from `game.fen()`. Chessground doesn't know about en passant captures or promotions, so this is what makes them show up.
4. Updates the turn, legal moves, last-move highlight, and check highlight.
5. Stops the clock and freezes the board if `game.status()` says the game is over. Otherwise it starts the other side's clock.
6. Updates the status line.

**New Game:** create a new game, reset the clock, and reset the board and status line.

**Chessground setup**

- Set `movable.free` to `false`. It defaults to `true`, which allows any move.
- Set `movable.color` to the side to move, and turn premoves off.
- Load `chessground.base.css`, `chessground.brown.css`, and `chessground.cburnett.css` from the package's `assets` folder.
- Give `.cg-wrap` a square size in `style.css`, because the base CSS doesn't set one.

## Status line

| Situation | Text |
| :--- | :--- |
| Game running | `White to move` / `Black to move` |
| In check | `White to move, in check` |
| Checkmate | `Checkmate. Black wins.` |
| Time ran out | `White wins on time.` |
| Stalemate | `Draw by stalemate.` |
| Threefold repetition | `Draw by threefold repetition.` |
| Fifty-move rule | `Draw by the fifty-move rule.` |
| Insufficient material | `Draw by insufficient material.` |

## Testing

The reasoning is in [ADR 0004](../adr/0004-chessground-demo-testing.md).

**Unit tests** (`npm test`)

- **Clock:** starts full and not running, charges time to the right side, switches sides, stops, resets, flags at zero, and never goes below zero.
- **Adapter:** 20 legal moves at the start, a legal move updates the FEN, an illegal move is rejected and changes nothing, a promotion with no letter gives a queen, promotion squares appear only once in `legalMoves()`, and every ending in the status table except time.

**Browser checklist** (`npm run dev`). Each line starts from a new game.

- [ ] The board shows the starting position with White at the bottom. Both clocks show 10:00 and aren't running.
- [ ] Clicking a piece highlights its legal squares. Clicking or dragging to one of them plays the move.
- [ ] A piece dropped on an illegal square goes back. Neither side can move out of turn.
- [ ] `1. e4` starts Black's clock, and White's stays at 10:00.
- [ ] Castling, `1. e4 e5 2. Nf3 Nf6 3. Bc4 Bc5 4. O-O`: the rook moves too.
- [ ] En passant, `1. e4 a6 2. e5 d5 3. exd6`: the captured pawn disappears.
- [ ] Promotion, `1. a4 b5 2. axb5 a6 3. bxa6 h6 4. a7 h5 5. axb8`: the pawn becomes a queen.
- [ ] Check, `1. e4 e5 2. Qh5 Nc6 3. Qxf7+`: the king is highlighted and the status says `Black to move, in check`.
- [ ] Checkmate, `1. f3 e5 2. g4 Qh4#`: the status says `Checkmate. Black wins.` The board and clocks freeze.
- [ ] Threefold repetition, `1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8`: the status says `Draw by threefold repetition.`
- [ ] Timeout: set `INITIAL_SECONDS` to 5, play one move for White, and wait. The status says `White wins on time.` Change it back afterward.
- [ ] Background tab: play one move, switch tabs for 30 seconds, and come back. About 30 seconds should be gone.
- [ ] New Game resets the board, clocks, and status line, even after a game has ended.

## Before deploying or comparing

- **Deploying:** chessground is GPL-3.0-or-later and this repo is ISC. Don't deploy this version to GitHub Pages until #13 is decided.
- **Comparing:** this demo includes chess.js and a clock, so #13 needs to compare like with like.
