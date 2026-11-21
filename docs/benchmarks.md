# Engine benchmarks

## Usage

Use Node 24 (`.nvmrc`), run `npm ci`, then run commands from the repository root:

```sh
# Full measurement: five rounds; writes summary JSON and CSV
npm run bench

# Name this run (shown on every chart)
npm run bench -- --label engine-v1

# Development check; not an official performance result
npm run bench -- --quick --tasks applyMove,isValidMove

# Measure a historical engine using the current benchmark and dependencies
git worktree add --detach ../knightsky-baseline d4eb7cc
npm run bench -- --engine-root ../knightsky-baseline --label baseline

# Compare saved PR base/head results
npm run bench:compare -- --before path/to/base.json --after path/to/head.json

# Charts: all saved runs, or selected runs/tasks
npm run bench:charts -- --all
npm run bench:charts -- --runs RUN_ID_1 --runs RUN_ID_2 --tasks replay
npm run bench:charts -- --all --input benchmarks/engine/results --tasks applyMove
```

Results are saved under `benchmarks/engine/results/`; SVG charts under
`benchmarks/engine/charts/`. Repeat `--runs` or `--tasks` to select several.
Task names match by prefix. Chart groups separate incompatible environments and
measurement methods; repeated measurements remain separate points. Unsupported
tasks are omitted rather than plotted as zero.

Each compatible group produces at most **eight charts**, one per category:
perft, applyMove, legalMoves, isValidMove, getGameStatus, replay, FEN, and PGN.
Each chart contains separate scenario panels with independent scales and compares
all selected runs with chess.js. Scenarios are not averaged together. Run names
always use `metadata.label`; missing/blank labels show `Unlabeled`. Use distinct
labels for versions. Full run IDs and environment details remain in `runs.json`.

For every engine PR, compare the actual base and head using the same machine,
Node, dependencies, inputs, and settings. Reuse a compatible saved base result,
or rerun both versions in the same session. The original baseline is
`d4eb7cc966a6700204f95e730f3e9cef8e799c75`, before #45.
Older checkouts need no benchmark files or dependencies; missing public APIs
produce an explicit error. Benchmarks run separately from `npm test`.

## Workloads

| Task | One reported operation |
| --- | --- |
| Perft: start depth 4 | 197,281 leaves |
| Perft: Kiwipete depth 3 | 97,862 leaves |
| Perft: positions 3–5 depth 3 | 2,812 / 9,467 / 62,379 leaves |
| `applyMove/history0`, `history60` | One move on a prepared state |
| `legalMoves/*` | All legal UCI moves for one position |
| `isValidMove/*` | One legal / illegal / malformed UCI query |
| `getGameStatus/*` | Status, winner, draw reason |
| `replay/200-games` | Restore all 200 fixed games |
| `fen/load/*`, `fen/save/*` | Load / save one FEN |
| `pgn/replay/200-games` | Replay all PGNs, when supported |

Inputs are committed: xorshift32 seed 2100050, sorted UCI move selection, and 200
games capped at 40/60/80/100/120 plies or game over. Do not regenerate inputs
between engine versions. `npm run bench:fixtures` recreates them using pinned
chess.js 1.4.0. Generation and correctness checks are outside the timed region.

Before measuring, validate corpus integrity, exact perft counts, legal moves,
replay positions, and statuses including repetition and other draws. Legal move
sets check en passant semantics when non-capturable FEN spelling differs.
Failure aborts measurement. PGN requires `replayPGN(pgn): Result<GameState>`;
until #69 supplies it, ours records unsupported, while reference-only PGN is
available. A different parser contract needs an adapter update and validation.

## Method and parameters

Five fresh Vitest processes run serially, alternating library order per round.
Each task warms up for at least 100 ms / two iterations and measures at least
300 ms / five iterations. Slow tasks may exceed these budgets substantially.
Use an idle machine with stable power settings; full runs can take about ten minutes.

- `--rounds N`: 1–100 rounds; default five, or one with `--quick`.
- `--tasks prefix,prefix`: select workloads; every prefix must match.
- `--engine-root PATH`, `--label TEXT`: target checkout and human-readable label.
- `--output DIR`: override result or chart destination.
- `--keep-raw`: retain temporary Vitest sample files for diagnosis.
- `--quick`: shorter sampling, skips deep perft validation; results are tagged.

The main result is the **median of round medians**. Save weighted mean,
sample count, round median range, and `ops/sec = 1000 / medianMs` as well.
Validity queries execute in batches of 128 to reduce clock overhead; all
saved latencies and throughput are normalized to one query. Vitest's intermediate
terminal table describes batches; sample count also counts batches for those
tasks. Replay ops/sec counts complete 200-game batches.

Each invocation saves one JSON and CSV summary, not intermediate samples.
Metadata includes engine commit/source hash/dirty state, harness source hash,
fixture hash, date, Node/library versions, CPU/OS/machine ID, and settings.
Source changes during a measurement abort saving. Quick results and different
methods or environments cannot be directly compared. Task filters may differ:
only shared tasks are compared. Charts retain each run's provenance.

### Reference interpretation

The primary comparison is **ours before vs. ours after**. chess.js is a public
API reference, not an isolated algorithm comparison. Both libraries use their
public entry points; chess.js verbose/SAN construction and UCI conversion are
included in move enumeration. Its validity adapter rejects malformed input
immediately and searches only the selected piece. Status checks have the same
terminal/draw semantics.

Perft uses identical recursion and depth-1 leaf counting; chess.js undo is timed.
Single-move setup and undo are outside timing via pinned Tinybench task hooks.
FEN loading includes the public constructor's work (ours computes status).
These API differences must accompany cross-library claims.

`oursOverChessjs = oursMedianMs / chessjsMedianMs`; below one means ours takes
less time. The ratio is useful context, but hardware still matters. Use one
designated machine for presentation history, and avoid percentage-based gates
on shared CI runners. Vitest 2.1.9 and chess.js 1.4.0 are pinned.

## Current results

Only the current-code run labeled **engine-v0** is retained; previous result
files and charts have been cleared.
Run: `2026-11-21T00-38-57-261Z-9a82cae`, commit `9a82cae`, Apple M4 / arm64,
Darwin 24.6.0, Node v24.22.3, five rounds, clean engine source. The harness
is uncommitted; its source hash is saved. All 71 library/task rows and 35 ratios
are in the JSON/CSV summaries.

| Task | Ours median ms | chess.js median ms | Ours / chess.js |
| --- | ---: | ---: | ---: |
| Start perft depth 4 | 193.336166 | 3657.249542 | 0.0529 |
| Kiwipete perft depth 3 | 114.820208 | 3329.421625 | 0.0345 |
| Apply move, no history | 0.008750 | 0.023875 | 0.3665 |
| Apply move, 60-ply history | 0.011375 | 0.048208 | 0.2360 |
| Validate legal move, 60-ply history | 0.011384 | 0.049412 | 0.2304 |
| Reject malformed UCI, 60-ply history | 0.001370 | 0.000012 | 113.7594 |
| Replay all 200 games | 200.599375 | 984.144792 | 0.2038 |

Very short queries are approximate even with batching. Ratios describe these
specific public API paths, not general engine superiority. #45 and #57 have
not yet been measured. `npm run bench:charts -- --all` generates the eight
category charts for this run, all displaying the label `engine-v0`.

