# Chessground Demo Spec

- **Issue:** #12
- **Status:** Draft
- **Date:** 2026-11-09
- **Related:** #10 and #13 (comparison with our own board), [ADR 0004](../adr/0004-chessground-demo-testing.md) (testing)

## What we're building

A small chess page built on [chessground](https://github.com/lichess-org/chessground), using our own engine for the rules. Either two people share one browser, or one person plays our Stockfish bot. Both modes play a full game against a clock.

It exists so #13 can compare chessground with our own board rendering, so it stays simple.

| Included | Left out for now |
| :--- | :--- |
| Board with your side at the bottom | Draw offers |
| Legal moves highlighted, click or drag to move | Skins |
| Only legal moves allowed | Move list |
| Clock | Online play |
| Status line | Choosing a promotion piece (pawns always become queens) |
| Player vs Player, or the bot at four levels (Easy, Medium, Hard, Max) | |
| Play White or Play Black against the bot | |
| Start New Game and Resign buttons | |

## What the page looks like

Player vs Player, playing White (`*` marks the selected button):

```
[ * Player vs Player ] [ Bot Easy ] [ Bot Medium ] [ Bot Hard ] [ Bot Max ]
[ * Play White ] [ Play Black ]
White to move            <- status line

Black   10:00
┌─────────────────┐
│                 │
│      board      │
│                 │
└─────────────────┘
White   10:00

[ Start New Game ] [ Resign ]
```

Against the easy bot, playing Black. The board flips so Black is at the bottom:

```
[ Player vs Player ] [ * Bot Easy ] [ Bot Medium ] [ Bot Hard ] [ Bot Max ]
[ Play White ] [ * Play Black ]
White to move            <- status line

White   10:00
┌─────────────────┐
│                 │
│      board      │
│                 │
└─────────────────┘
Black   10:00

[ Start New Game ] [ Resign ]
```

## Who does what

Chessground only draws the board and handles clicks and drags. It doesn't know the rules of chess, so the rest is ours.

| File in `src/app/chessground-demo/` | Job |
| :--- | :--- |
| `index.html` | The page |
| `style.css` | Board size and layout |
| `main.js` | Connects the board, the game, the clock, and the page |
| `game.js` | The adapter. Knows the rules by using our own engine in `src/engine` |
| `clock.js` | Tracks each side's time. Knows nothing about the page |
| `testing/game.test.js`, `testing/clock.test.js` | Unit tests |
| `src/bot/stockfish.js` | The bot. Runs Stockfish in a Web Worker and returns a move for a FEN and level. See `src/bot/README.md` |

**Setup:** `@lichess-org/chessground` is a dependency and `vite` is a dev dependency. `npm run dev` and `npm run build` use the `vite.config.js` at the repo root, which builds this folder (see [Deployment](../deployment.md)). That config also serves the Stockfish files from `src/bot/assets/` at `/stockfish/`.

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

**Promotion:** `main.js` sends moves with no promotion letter, such as `a7b8`. The engine needs one, so `game.js` fills in a queen. The bot's moves go through the same path, so the bot also always promotes to a queen.

**The game stays in memory** inside the adapter, rather than being rebuilt from a FEN each time. Threefold repetition needs earlier positions, which a FEN doesn't contain, so the adapter keeps the engine's game state (including `positionHistory`).

### Which engine function backs each method

`game.js` is the only file that imports `src/engine`.

| Function | Engine function |
| :--- | :--- |
| `createGame(fen)` | `createGame(fen)` |
| `fen()` | `GameStatetoFEN(state)` |
| `turn()` | `state.currentTurn` |
| `legalMoves()` | `legalMoves(state)`, grouped by starting square |
| `move(uci)` | `applyMove(state, uci)` |
| `status()` | `state.status`, `state.winner`, `state.drawReason`, and `isInCheck(state)` |

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

**Page load:** create a game and a clock in Player vs Player mode. The board shows the starting position, White is to move, and both clocks show 10:00 and aren't running.

**When a move is played,** by a person (through chessground's `movable.events.after`) or by the bot, `main.js` does the following:

1. Checks the clock. If time had already run out, the timeout wins and the move is discarded.
2. Plays the move with `game.move()`.
3. Redraws the board from `game.fen()`. Chessground doesn't know about en passant captures or promotions, so this is what makes them show up.
4. Updates the turn, legal moves, last-move highlight, and check highlight.
5. Stops the clock and freezes the board if `game.status()` says the game is over. Otherwise it starts the other side's clock.
6. Updates the status line.
7. In bot mode, if it's now the bot's turn, asks the bot for a move.

**Bot mode:** the person can only move their own pieces. On the bot's turn, `main.js` sends the FEN and level to `getBotMove`. If a new game started or the game ended while the bot was thinking, the bot's answer is ignored. The bot's clock runs while it thinks.

**Mode and color buttons:** choosing Player vs Player, a bot level, Play White, or Play Black starts a new game. Against the bot, the board turns so the person's side is at the bottom, and the bot moves first when the person plays Black. Player vs Player always has White at the bottom.

**Start New Game:** create a new game, reset the clock, and reset the board and status line. Keeps the current mode and color.

**Resign:** ends the game and the other side wins. In Player vs Player, the side to move resigns. Against the bot, the person resigns, even during the bot's turn.

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
| Resigned | `Black wins by resignation.` |
| Bot error | `The bot failed to move. Start a new game.` |

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
- [ ] Resign in Player vs Player: after `1. e4`, Resign says `White wins by resignation.` The board and clocks freeze.
- [ ] Bot Easy, Play White: after each of your moves, the bot answers and its clock runs while it thinks.
- [ ] Bot Easy, Play Black: the board turns with Black at the bottom and the bot plays White's first move. You can't move White's pieces.
- [ ] Bot Max: start a game, then press Start New Game while the bot is thinking. The new board stays at the starting position.
- [ ] Resign against the bot while it's thinking: the bot's side wins and the bot's answer doesn't appear on the board.

## Before deploying or comparing

- **Deploying:** the deploy job from [ADR 0006](../adr/0006-deploy-to-github-pages.md) now builds this demo. chessground and Stockfish are GPL-3.0 and this repo is ISC, so licensing still needs to be settled in #13.
- **Comparing:** this demo includes our engine, the bot, and a clock, so #13 needs to compare like with like.
