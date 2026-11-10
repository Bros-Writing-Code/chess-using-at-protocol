// Hand-rolled: 64 <div>s in a CSS grid. Only squares whose piece changed are touched.
import { placementToGrid } from "../positions.js";
import { GLYPH, LIGHT, DARK } from "./glyphs.js";

let squares = [];
let current = [];

function show(placement) {
  const grid = placementToGrid(placement);
  for (let i = 0; i < 64; i++) {
    if (grid[i] !== current[i]) {
      squares[i].textContent = GLYPH[grid[i]] ?? "";
      current[i] = grid[i];
    }
  }
}

export default {
  id: "dom",
  label: "Hand-rolled: DOM + CSS Grid (diffed updates)",
  mount(container, placement) {
    container.style.cssText += "display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);";
    squares = [];
    current = new Array(64).fill(undefined);
    for (let i = 0; i < 64; i++) {
      const sq = document.createElement("div");
      const row = i >> 3, col = i & 7;
      sq.style.cssText = `display:grid;place-items:center;font-size:44px;background:${(row + col) % 2 ? DARK : LIGHT}`;
      container.appendChild(sq);
      squares.push(sq);
    }
    show(placement);
  },
  setPosition: show,
};
