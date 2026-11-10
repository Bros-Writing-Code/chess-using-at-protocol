// Shared benchmark harness. Every method supplies an adapter:
//
//   {
//     label: "Human readable name",
//     mount(container, placement)  // draw the first position (may be async)
//     setPosition(placement)       // show a new position (may return a promise)
//     destroy?()                   // optional cleanup
//   }
//
// Animations must be turned off in every adapter so we measure rendering, not tweening.

import { START, generatePositions } from "./positions.js";

const BOARD_PX = 560;
const POSITIONS = 300; // positions per pass
const PASSES = 5; // measured passes (one extra warm-up pass is discarded)

const now = () => performance.now();
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

function heapMB() {
  const m = performance.memory;
  return m ? m.usedJSHeapSize / 1048576 : null;
}

async function settleHeap() {
  if (typeof window.gc === "function") {
    window.gc();
    await new Promise((r) => setTimeout(r, 50));
    window.gc();
  }
  return heapMB();
}

function stats(values) {
  const s = [...values].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return { median: q(0.5), p95: q(0.95), mean, min: s[0], max: s[s.length - 1] };
}

function resourceSummary() {
  const sums = { js: 0, css: 0, other: 0, jsTransfer: 0, cssTransfer: 0, otherTransfer: 0 };
  for (const e of performance.getEntriesByType("resource")) {
    const path = new URL(e.name).pathname;
    const kind = path.endsWith(".js") ? "js" : path.endsWith(".css") ? "css" : "other";
    sums[kind] += e.decodedBodySize || 0;
    sums[kind + "Transfer"] += e.transferSize || 0;
  }
  const nav = performance.getEntriesByType("navigation")[0];
  return {
    jsKB: sums.js / 1024,
    cssKB: sums.css / 1024,
    otherKB: sums.other / 1024,
    jsTransferKB: sums.jsTransfer / 1024,
    domContentLoadedMs: nav ? nav.domContentLoadedEventEnd : null,
    loadMs: nav ? nav.loadEventEnd : null,
  };
}

async function execute(adapter, container) {
  const positions = generatePositions(POSITIONS);
  const forceLayout = () => container.getBoundingClientRect();

  const heapBefore = await settleHeap();

  // --- initial render ---
  const t0 = now();
  await adapter.mount(container, START);
  forceLayout();
  const initialSyncMs = now() - t0;
  await nextFrame();
  const initialToFrameMs = now() - t0; // quantized to the display refresh (~16.7 ms)

  const heapAfterMount = await settleHeap();

  // --- warm-up pass (discarded), then measured passes ---
  const apply = async (p) => {
    const r = adapter.setPosition(p);
    if (r && typeof r.then === "function") await r;
  };
  for (const p of positions) await apply(p);

  const syncTimes = [];
  const layoutTimes = [];
  const passTotals = [];
  for (let pass = 0; pass < PASSES; pass++) {
    await apply(START);
    const passStart = now();
    for (const p of positions) {
      const s0 = now();
      await apply(p);
      const s1 = now();
      forceLayout();
      const s2 = now();
      syncTimes.push(s1 - s0);
      layoutTimes.push(s2 - s0);
    }
    passTotals.push(now() - passStart);
    await nextFrame();
  }

  const heapAfterUpdates = await settleHeap();
  const domNodes = container.querySelectorAll("*").length;

  return {
    name: adapter.id,
    label: adapter.label,
    date: new Date().toISOString(),
    userAgent: navigator.userAgent,
    config: { boardPx: BOARD_PX, positions: POSITIONS, passes: PASSES },
    initial: { syncMs: initialSyncMs, toFrameMs: initialToFrameMs },
    update: stats(syncTimes),
    updateWithLayout: stats(layoutTimes),
    passTotalMs: stats(passTotals),
    memory: {
      available: heapBefore !== null,
      gcExposed: typeof window.gc === "function",
      heapBeforeMB: heapBefore,
      heapAfterMountMB: heapAfterMount,
      heapAfterUpdatesMB: heapAfterUpdates,
    },
    domNodes,
    resources: resourceSummary(),
  };
}

const f = (n, d = 2) => (n === null || n === undefined ? "n/a" : n.toFixed(d));

function format(r) {
  return [
    `${r.label}`,
    ``,
    `Initial render (mount + layout):  ${f(r.initial.syncMs)} ms`,
    `Initial render (to next frame):   ${f(r.initial.toFrameMs)} ms`,
    ``,
    `Update, median / p95:             ${f(r.update.median)} / ${f(r.update.p95)} ms`,
    `Update + layout, median / p95:    ${f(r.updateWithLayout.median)} / ${f(r.updateWithLayout.p95)} ms`,
    `${r.config.positions} updates back to back, median: ${f(r.passTotalMs.median)} ms`,
    ``,
    `Page JS / CSS / other (decoded):  ${f(r.resources.jsKB, 1)} / ${f(r.resources.cssKB, 1)} / ${f(r.resources.otherKB, 1)} KB`,
    `DOMContentLoaded / load:          ${f(r.resources.domContentLoadedMs, 0)} / ${f(r.resources.loadMs, 0)} ms`,
    ``,
    r.memory.available
      ? `Heap before / after mount / after updates: ${f(r.memory.heapBeforeMB)} / ${f(r.memory.heapAfterMountMB)} / ${f(r.memory.heapAfterUpdatesMB)} MB` +
        (r.memory.gcExposed ? "" : "  (no forced GC: numbers are noisy)")
      : `Heap: not available (Chrome only)`,
    `DOM nodes inside the board:       ${r.domNodes}`,
  ].join("\n");
}

export function run(adapter) {
  document.title = `Bench: ${adapter.label}`;
  document.body.style.cssText = "font-family: system-ui, sans-serif; margin: 16px;";

  const header = document.createElement("div");
  header.innerHTML = `<h1 style="font-size:20px;margin:0 0 8px">${adapter.label}</h1>`;
  const button = document.createElement("button");
  button.textContent = "Run benchmark";
  const out = document.createElement("pre");
  out.style.cssText = "background:#f4f4f4;padding:12px;min-height:6em;font-size:13px;";
  out.textContent = "Press the button. Don't touch the page until it finishes.";
  const board = document.createElement("div");
  board.id = "board";
  board.style.cssText = `width:${BOARD_PX}px;height:${BOARD_PX}px;position:relative;margin-top:12px;`;
  header.append(button, out);
  document.body.append(header, board);

  button.onclick = async () => {
    button.disabled = true;
    out.textContent = "Running...";
    try {
      const result = await execute(adapter, board);
      out.textContent = format(result);
      try {
        localStorage.setItem("bench:" + adapter.id, JSON.stringify(result));
      } catch {}
    } catch (err) {
      out.textContent = "Benchmark failed:\n" + (err && err.stack ? err.stack : err);
      console.error(err);
    }
    button.disabled = false;
  };
}

export { BOARD_PX };
