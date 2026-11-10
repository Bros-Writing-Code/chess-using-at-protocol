// Hand-rolled: one <svg>, 64 <rect>s, and a <text> per piece. Pieces are rebuilt on every update.
import { placementToGrid } from "../positions.js";
import { GLYPH, LIGHT, DARK } from "./glyphs.js";

const NS = "http://www.w3.org/2000/svg";
let piecesLayer;

function show(placement) {
  const grid = placementToGrid(placement);
  piecesLayer.replaceChildren();
  for (let i = 0; i < 64; i++) {
    if (!grid[i]) continue;
    const t = document.createElementNS(NS, "text");
    t.setAttribute("x", (i & 7) + 0.5);
    t.setAttribute("y", (i >> 3) + 0.5);
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("dominant-baseline", "central");
    t.setAttribute("font-size", "0.8");
    t.textContent = GLYPH[grid[i]];
    piecesLayer.appendChild(t);
  }
}

export default {
  id: "svg",
  label: "Hand-rolled: SVG (pieces rebuilt each update)",
  mount(container, placement) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 8 8");
    svg.style.cssText = "width:100%;height:100%;display:block";
    for (let i = 0; i < 64; i++) {
      const r = document.createElementNS(NS, "rect");
      r.setAttribute("x", i & 7);
      r.setAttribute("y", i >> 3);
      r.setAttribute("width", 1);
      r.setAttribute("height", 1);
      r.setAttribute("fill", (((i >> 3) + (i & 7)) % 2) ? DARK : LIGHT);
      svg.appendChild(r);
    }
    piecesLayer = document.createElementNS(NS, "g");
    svg.appendChild(piecesLayer);
    container.appendChild(svg);
    show(placement);
  },
  setPosition: show,
};
