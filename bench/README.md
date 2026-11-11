# UI rendering benchmarks

Compares hand-rolled board rendering against existing chess UI libraries.

| id | Method |
|---|---|
| `baseline` | Empty page with only the harness (the fixed overhead in every other row) |
| `dom` | Hand-rolled DOM + CSS Grid |
| `svg` | Hand-rolled SVG |
| `canvas` | Hand-rolled Canvas 2D |
| `chessground` | Chessground (Lichess) |
| `cmchessboard` | cm-chessboard |
| `reactchessboard` | react-chessboard v4 (React 18 is bundled in) |
| `chessboardjs` | chessboard.js (needs jQuery) |

## Run it

```sh
npm install
npm install -D esbuild chessground cm-chessboard react@18 react-dom@18 react-chessboard@4 @chrisoakman/chessboardjs jquery
npm run bench:build     # bundles every method into bench/dist/ (gitignored)
npm run bench:serve     # http://localhost:8080/
```

Serve over http, not file://. Resource sizes and `localStorage` results don't work from `file://`.

For the most reliable numbers, use Chrome with extensions off (or a fresh profile) and start it with:

```sh
open -a "Google Chrome" --args --enable-precise-memory-info --js-flags=--expose-gc
```

Open each method's page in its own fresh tab, press **Run benchmark**, and leave the tab alone until it finishes. Reload `index.html` to see the combined table. Repeat the whole thing a few times and compare the medians, not single runs.

## Side-by-side comparison

Open `http://localhost:8080/compare.html`. All boards render the same position at the same time, so you can compare how each looks and spot rendering bugs. Use Prev/Next/Play or the slider to step through 300 positions, and **Run stress test** to time 300 updates per method and see the result as bars. The bottom of the page charts the results saved by the individual benchmark pages.

## What is measured

- **Initial render:** mounting the board with the starting position, plus a forced layout. A second figure includes waiting for the next frame, but it is rounded to the display's refresh interval.
- **Update:** applying 300 successive positions (one random piece jump each). One warm-up pass is discarded, then 5 measured passes. Reported as median and p95, with and without a forced layout, plus the total for 300 back-to-back updates.
- **Size and load:** decoded JS, CSS, and other file sizes and DOMContentLoaded/load times from the Resource Timing API. Subtract the `baseline` row for the cost of the harness.
- **Memory:** JS heap before mounting, after mounting, and after the updates (Chrome only, and only stable when started with `--expose-gc`). Also the DOM node count inside the board.

## Caveats (read before drawing conclusions)

- The hand-rolled methods draw Unicode glyphs. The libraries draw SVG or PNG pieces and support drag-and-drop and highlights, so they do more work per update. The comparison shows the cost of that extra capability, not a like-for-like drawing speed.
- All animations are switched off so we measure rendering, not tweening.
- The positions are not legal chess games (pieces jump anywhere). That is fine for rendering but is not an engine test.
- Paint time isn't captured directly. The forced layout covers style and layout but not rasterization, which matters most for the Canvas method.
- A 64-square board is small. Differences in update time may be sub-millisecond and below the noise. Bundle size, load time, and how much code the team has to maintain probably matter more for the final decision.
- The library adapters were written from the libraries' documented APIs and have not been run yet. If one fails, the page prints the error. The most likely causes are API changes between versions (cm-chessboard asset paths, chessboard.js file names).
