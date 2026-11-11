# Why Chessground? Benchmark results and recommendation

Related: issue #13 (Chessground vs. vibe-coded performance test), issue #12, PR #14 (Chessground demo), PR #15 (benchmark harness).

Results were collected on 2026-11-10/11 from the harness in `bench/`, in one Chrome tab per method, on a MacBook Air. The libraries tested were Chessground 9.2.1, cm-chessboard 8.15.4, react-chessboard 4.7.3 (with React 18), and chessboard.js 1.0.0.

## Short version

**Speed does not decide this.** On a 64-square board every method updates in about a millisecond or less, and a person can't tell the difference. The benchmark also has measurement problems (below), so it can't support a claim that Chessground is *faster*.

The case for Chessground rests on:
1. **Size.** It ships far less code than react-chessboard (about 48 KB against about 235 KB, net of the harness) and roughly the same as cm-chessboard.
2. **What it already does.** Dragging, legal-move highlighting, arrows and animations are built in. Our hand-rolled boards would need all of that written and tested by us.
3. **Fit with our engine.** It takes a FEN in and a list of legal destinations, which maps directly onto `FENtoGameState` and `moveGeneration`.
4. **No framework needed.** It is plain JS, so it works whichever UI approach we pick.

**One blocker to settle first: Chessground is GPL-3.0-or-later.** The other three libraries are MIT. Our `package.json` says ISC. Using Chessground in a distributed app generally means the app must also be released under the GPL. This is a course project, so it may be fine, but the team should agree to it before committing.

## Raw results (single run per method)

Update times include a forced layout. "300 updates" is the median total for applying 300 positions back to back. JS, CSS and Other are decoded file sizes. Sizes include the harness (about 4.5 KB of JS), so subtract the baseline row to compare.

| Method | Initial (ms) | Update median (ms) | Update p95 (ms) | 300 updates (ms) | JS (KB) | CSS (KB) | Other (KB) | Heap (MB) | DOM nodes at end |
|---|---|---|---|---|---|---|---|---|---|
| Baseline (harness only) | 0.6 | 0.00 | 0.0 | 0.6 | 4.5 | 0 | 0 | 10.21 | 0 |
| Hand-rolled Canvas | 25.3 | 0.00 | 0.1 | 5.2 | 5.1 | 0 | 0 | 8.36 | 1 |
| Hand-rolled DOM + Grid | 58.1 | 0.1 | 0.2 | 33.2 | 5.1 | 0 | 0 | 7.33 | 64 |
| Hand-rolled SVG | 15.7 | 0.1 | 0.6 | 68.0 | 5.4 | 0 | 0 | 9.03 | 67 |
| **Chessground** | 16.2 | 0.00 | 0.0 | 0.7 | 34.9 | 17.3 | 0 | 9.44 | 11 |
| cm-chessboard | 9.1 | 33.3 | 34.8 | 9999.4 | 37.8 | 8.2 | 22.6 | 7.60 | 76 |
| react-chessboard | 6.0 | 0.4 | 0.6 | 132.8 | 239.9 | 0 | 0 | 18.6 | 147 |
| chessboard.js | 46.7 | 0.2 | 1.0 | 102.2 | 99.7 | 0.7 | 0 | 9.53 | 83 |

## Read the numbers carefully: known problems

These were found while writing this up. Treat the table as a first pass, not as a verdict.

1. **The test positions are nearly empty.** The generator moves a random piece to a random square, so it keeps capturing. The piece count falls from 32 to about 15 by position 50, 8 by position 100, and 1 by position 299. Most of the test therefore renders a handful of pieces, which flatters every method and hides the cost of a full board. This also explains the low "DOM nodes at end" values. The generator should move pieces only to empty squares so the piece count stays at 32.
2. **Chessground's update time is not a real render time.** Chessground defers its drawing to the next animation frame (`debounceRedraw` uses `requestAnimationFrame`). The harness timed only the call that schedules the redraw, so 0.7 ms for 300 updates is the scheduling cost, not the drawing cost. The rendering work isn't captured.
3. **cm-chessboard's update time is a frame-timing artifact.** Its `setPosition` returns a promise that completes on animation frames, so each update shows up as about 33 ms (two frames at 60 Hz) and 300 updates as about 10 s. That is the harness waiting for the display, not the cost of rendering. The real drawing cost is almost certainly far lower. This probably also explains why cm-chessboard looked "broken": it appeared stuck compared with the others.
4. **One run each.** Memory ran without forced garbage collection (`gc` was not exposed), so the heap numbers are noisy. The initial-render times (for example 58 ms for DOM against 16 ms for SVG) vary a lot between runs and mostly reflect first-paint effects, so don't read much into them.
5. **Different piece art.** The hand-rolled boards and the chessboard.js adapter draw Unicode glyphs. The libraries draw real piece graphics. The libraries also support interaction that the hand-rolled boards don't have.
6. **No paint cost.** Only style and layout are timed, not rasterization. This matters most for Canvas.

## What the data does support

- Every method's update cost is negligible for a 64-square board (well under a frame, 16.7 ms), apart from the artifacts in items 2 and 3. **Speed is not a reason to avoid any option and not a reason to choose Chessground.**
- **Bundle size separates the options clearly.** Net of the 4.5 KB harness, the JS plus CSS plus sprite is roughly:
  - hand-rolled: under 1 KB
  - Chessground: about 48 KB
  - cm-chessboard: about 64 KB
  - chessboard.js: about 96 KB (and its npm package ships no piece images)
  - react-chessboard: about 235 KB (it includes React)
- **React adds the largest cost.** react-chessboard has the largest JS bundle, the highest heap (18.6 MB against about 8 to 10 MB for the rest) and the slowest load. If the team doesn't need React for other reasons, this is a point against it.
- **Chessground renders few DOM nodes.** It ended with 11 (see problem 1, so this is not a fair comparison). Its design keeps the node count low.

## Why Chessground, beyond the benchmark

These points come from the library's documented features and the project's own needs. The benchmark did not measure them.

- **Mature and widely used.** It is the board Lichess runs, which is evidence of fixed bugs, mobile and touch handling, and accessibility work that we would otherwise redo ourselves.
- **Interaction included.** Drag-and-drop, click-to-move, arrows, highlights and animations are built in. The hand-rolled options give us only a static board plus whatever we write.
- **Matches our engine.** Chessground takes a FEN and accepts a map of legal destinations per square. The engine already generates legal moves and converts to and from FEN, so the UI only passes those in.
- **Framework-independent.** It works with plain JS or any framework, so it doesn't decide the framework question.
- **Already in progress.** PR #14 has a Chessground demo.

## Risks and costs

- **GPL-3.0-or-later license** (see the top of this page). This is the main thing to decide.
- **Learning curve.** Its API is configured through one large options object, and the team has to learn it.
- **Less control.** Anything unusual in how the board looks or behaves means working around the library.
- **Extra CSS.** The base, theme and piece CSS add about 17 KB, and pieces are loaded through CSS.

## Recommended next steps

1. Decide whether the GPL-3.0 license is acceptable. If not, cm-chessboard (MIT) is the closest alternative.
2. Fix the benchmark before quoting any numbers:
   - keep the piece count at 32 in the generated positions
   - for Chessground, wait for the next frame after each update and time that
   - for cm-chessboard, measure the draw itself rather than the animation-frame promise
   - run each method several times, with Chrome started with `--enable-precise-memory-info --js-flags=--expose-gc`
3. Re-run and replace the table above.
4. Compare against the "vibe coded" React UI from issue #10 once it exists, which is the comparison issue #13 originally asked for.
