// Deterministic test positions shared by every benchmark.
// Positions are FEN piece-placement strings, e.g. "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR".
// They are NOT legal chess games: random pieces jump to random squares, which is
// all a rendering benchmark needs (many squares change on every update).

export const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

/** Placement string -> array of 64 entries ('' for empty), index = row * 8 + col, row 0 = rank 8. */
export function placementToGrid(placement) {
  const grid = [];
  for (const ch of placement) {
    if (ch === "/") continue;
    if (ch >= "1" && ch <= "8") {
      for (let i = 0; i < Number(ch); i++) grid.push("");
    } else {
      grid.push(ch);
    }
  }
  return grid;
}

/** Array of 64 entries -> placement string. */
export function gridToPlacement(grid) {
  const rows = [];
  for (let r = 0; r < 8; r++) {
    let row = "";
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = grid[r * 8 + c];
      if (!p) {
        empty++;
      } else {
        if (empty) row += empty;
        empty = 0;
        row += p;
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return rows.join("/");
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `count` successive positions starting from START, each one move after the last. */
export function generatePositions(count = 300, seed = 1234) {
  const rand = mulberry32(seed);
  const grid = placementToGrid(START);
  const out = [];
  while (out.length < count) {
    const from = Math.floor(rand() * 64);
    const to = Math.floor(rand() * 64);
    if (!grid[from] || from === to) continue;
    grid[to] = grid[from];
    grid[from] = "";
    out.push(gridToPlacement(grid));
  }
  return out;
}
