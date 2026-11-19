# Bot: Stockfish opponent

`stockfish.js` lets a player play against Stockfish in the browser. Stockfish runs as WebAssembly inside a Web Worker, so there is no server and the board never freezes while it thinks.

This folder is separate from `src/engine` on purpose. The engine is pure and synchronous; Stockfish is asynchronous and keeps its own state. Stockfish only **suggests** moves. Every move it suggests is still played through our engine (or the demo's `game.move`), which validates it.

## Usage

```js
import { createStockfishBot } from '../../bot/stockfish.js';

const bot = createStockfishBot();              // starts Stockfish in a Web Worker

// On the bot's turn:
const uci = await bot.getBotMove(game.fen(), 'medium');   // e.g. "e7e5"
game.move(uci);                                           // the engine validates it

// When leaving the page:
bot.terminate();
```

`getBotMove(fen, level)` returns a promise for a UCI move such as `e7e5` or `a7a8q`. It rejects if the level is invalid, the game is already over, or Stockfish fails to load, crashes, or does not answer in time. Show a "thinking…" state while the promise is pending, and lock the board.

If Stockfish fails, crashes or hangs, the bot throws that Worker away and the next `getBotMove` starts a fresh one, so a late answer from the old Worker can never be returned for a new position. A missing or broken Stockfish file is reported right away ("Stockfish worker error: failed to load"); a Worker that loads but never answers times out after 15 s.

## Difficulty

| `level` | What it means | Good for |
| --- | --- | --- |
| `'easy'` / `'medium'` / `'hard'` | Skill 2 / 8 / 15, thinking 0.3 / 0.6 / 1 s | Simple buttons |
| `'max'` | Skill 20, thinking 2 s: full strength of this build, far beyond any human | "Impossible" mode |
| `{ skill: 0–20 }` | Stockfish's own strength setting | A skill slider (covers very weak play) |
| `{ elo: 1320–3190 }` | Stockfish targets roughly this rating | An Elo slider |

`skill` and `elo` levels also accept `movetime` in milliseconds (50–10000, default 1000). Ranges are exported as `SKILL_RANGE` and `ELO_RANGE` for slider bounds.

## Files and license

- Browser build: `assets/stockfish/stockfish-19-lite-single.js` + `.wasm` (~1.8 MB), copied from the `stockfish` npm package (19.0.1, dev dependency, also used by the tests).
- Stockfish is licensed under **GPLv3**; its license is `assets/stockfish/COPYING.txt` and must ship with the app.

## Serving the files (for the app)

The browser has to load the two Stockfish files from a URL. By default the adapter looks for `/stockfish/stockfish-19-lite-single.js` (under Vite's base path). Vite only serves files under the app's root folder or its `public/` folder, and `src/bot/assets/` is outside both, so the app has to make the files reachable. Options:

1. **Point Vite's `publicDir` at `src/bot/assets` (what the Chessground demo does).** The root `vite.config.js` sets `publicDir: '../../bot/assets'` (relative to the app's folder, which is Vite's `root`), so `assets/stockfish/` is served at `/stockfish/` and nothing is copied. Restart `npm run dev` after changing it.
2. Serve them anywhere and pass the URL: `createStockfishBot({ createTransport: () => createWorkerTransport('/path/to/stockfish-19-lite-single.js') })`.

**Didn't copy the files into the app's `public/` folder.** We tried this for the Chessground demo (`src/app/chessground-demo/public/stockfish/`) and it broke `npm run lint`: ESLint ignores `src/bot/assets/` (it is a minified third-party build) but not the copy, so it reported 81 errors such as `'global' is not defined` and `Unnecessary escape character` in `stockfish-19-lite-single.js`. A copy also puts a second 1.8 MB binary in the repo that can fall out of date when Stockfish is upgraded. If you do need a copy, add its path to `globalIgnores` in `eslint.config.js`.

Keep the `.js` and `.wasm` files in the same folder; the `.js` loads the `.wasm` next to it.
- The "lite single-threaded" build is used because it is small and needs no special server headers. The full builds are ~99 MB, and the multi-threaded ones require cross-origin isolation headers.

## Tests

`testing/stockfish.test.js` covers the UCI conversation with a fake engine (handshake, queueing, timeouts, late answers, bad input) and runs the real engine in Node to check that every level returns a legal move and finds a mate in one.
