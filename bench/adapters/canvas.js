// Hand-rolled: a single 2D canvas, fully redrawn on every update.
import { placementToGrid } from "../positions.js";
import { GLYPH, LIGHT, DARK } from "./glyphs.js";

let ctx, size;

function show(placement) {
  const grid = placementToGrid(placement);
  const s = size / 8;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${s * 0.8}px serif`;
  for (let i = 0; i < 64; i++) {
    const x = (i & 7) * s, y = (i >> 3) * s;
    ctx.fillStyle = (((i >> 3) + (i & 7)) % 2) ? DARK : LIGHT;
    ctx.fillRect(x, y, s, s);
    if (grid[i]) {
      ctx.fillStyle = "#000";
      ctx.fillText(GLYPH[grid[i]], x + s / 2, y + s / 2);
    }
  }
}

export default {
  id: "canvas",
  label: "Hand-rolled: Canvas 2D (full redraw each update)",
  mount(container, placement) {
    size = container.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement("canvas");
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.cssText = `width:${size}px;height:${size}px;display:block`;
    container.appendChild(canvas);
    ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    show(placement);
  },
  setPosition: show,
};
