// Side-by-side comparison page: every method renders the SAME position at the same time.
// Step through positions to spot rendering differences or bugs, and run a stress test
// to see timings as bars.

import { START, generatePositions } from "./positions.js";
import dom from "./adapters/dom.js";
import svg from "./adapters/svg.js";
import canvas from "./adapters/canvas.js";
import chessground from "./adapters/chessground.js";
import cmchessboard from "./adapters/cmchessboard.js";
import reactchessboard from "./adapters/reactchessboard.js";
import chessboardjs from "./adapters/chessboardjs.js";

const ADAPTERS = [dom, svg, canvas, chessground, cmchessboard, reactchessboard, chessboardjs];
const BOARD_PX = 360;
const positions = [START, ...generatePositions(300)];
let index = 0;
let busy = false;

const $ = (sel) => document.querySelector(sel);
const f = (n, d = 2) => (n == null ? "n/a" : n.toFixed(d));
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

// ---- cards ----
const cards = ADAPTERS.map((adapter) => {
  const el = document.createElement("section");
  el.className = "card";
  el.innerHTML = `<h3>${adapter.label}</h3><div class="board" style="width:${BOARD_PX}px;height:${BOARD_PX}px"></div><p class="stat">mounting…</p>`;
  $("#grid").appendChild(el);
  return { adapter, board: el.querySelector(".board"), stat: el.querySelector(".stat"), last: [], error: null };
});

async function timeUpdate(card, placement) {
  const t0 = performance.now();
  const r = card.adapter.setPosition(placement);
  if (r && typeof r.then === "function") await r;
  card.board.getBoundingClientRect(); // force layout
  return performance.now() - t0;
}

function showStat(card, ms) {
  if (card.error) return;
  card.last.push(ms);
  if (card.last.length > 50) card.last.shift();
  card.stat.textContent = `last ${f(ms, 3)} ms · median of last ${card.last.length}: ${f(median(card.last), 3)} ms · ${card.board.querySelectorAll("*").length} DOM nodes`;
}

async function showPosition(i) {
  index = Math.max(0, Math.min(positions.length - 1, i));
  $("#pos").textContent = `Position ${index} / ${positions.length - 1}`;
  $("#slider").value = index;
  $("#fen").textContent = positions[index];
  for (const card of cards) {
    if (card.error) continue;
    try { showStat(card, await timeUpdate(card, positions[index])); }
    catch (e) { fail(card, e); }
  }
}

function fail(card, e) {
  card.error = e;
  card.stat.textContent = "ERROR: " + (e && e.message ? e.message : e);
  card.stat.style.color = "#b00020";
  console.error(card.adapter.id, e);
}

// ---- mount everything (one at a time so a broken library doesn't take the rest down) ----
(async () => {
  for (const card of cards) {
    try {
      const t0 = performance.now();
      await card.adapter.mount(card.board, positions[0]);
      card.board.getBoundingClientRect();
      card.stat.textContent = `mounted in ${f(performance.now() - t0)} ms`;
    } catch (e) { fail(card, e); }
  }
  $("#slider").max = positions.length - 1;
  enable(true);
})();

// ---- controls ----
let timer = null;
function enable(on) { for (const b of document.querySelectorAll("#controls button, #slider")) b.disabled = !on; }
$("#next").onclick = () => showPosition(index + 1);
$("#prev").onclick = () => showPosition(index - 1);
$("#reset").onclick = () => showPosition(0);
$("#slider").oninput = (e) => showPosition(Number(e.target.value));
$("#play").onclick = () => {
  if (timer) { clearInterval(timer); timer = null; $("#play").textContent = "Play"; return; }
  $("#play").textContent = "Pause";
  timer = setInterval(() => { if (index >= positions.length - 1) { clearInterval(timer); timer = null; $("#play").textContent = "Play"; } else showPosition(index + 1); }, 150);
};

// ---- stress test: all 300 positions on one board at a time, results as bars ----
$("#stress").onclick = async () => {
  if (busy) return;
  busy = true; enable(false);
  if (timer) { clearInterval(timer); timer = null; $("#play").textContent = "Play"; }
  const results = [];
  for (const card of cards) {
    if (card.error) continue;
    $("#stress-status").textContent = `Running ${card.adapter.label}…`;
    await new Promise((r) => setTimeout(r, 50));
    try {
      await timeUpdate(card, positions[0]);
      const times = [];
      for (let i = 1; i < positions.length; i++) times.push(await timeUpdate(card, positions[i]));
      results.push({ label: card.adapter.label, total: times.reduce((a, b) => a + b, 0), median: median(times) });
    } catch (e) { fail(card, e); }
  }
  $("#stress-status").textContent = "Done.";
  drawBars("#stress-chart", "Total time for 300 updates (ms) — lower is better", results.map((r) => ({ label: r.label, value: r.total })));
  await showPosition(0);
  busy = false; enable(true);
};

// ---- bar charts ----
function drawBars(sel, title, rows) {
  const max = Math.max(...rows.map((r) => r.value), 0.0001);
  const sorted = [...rows].sort((a, b) => a.value - b.value);
  $(sel).innerHTML = `<h3>${title}</h3>` + sorted.map((r) =>
    `<div class="bar-row"><span class="bar-label">${r.label}</span><span class="bar-track"><span class="bar" style="width:${(r.value / max) * 100}%"></span></span><span class="bar-val">${f(r.value, r.value < 10 ? 2 : 0)}</span></div>`).join("");
}

// ---- saved results from the individual benchmark pages (same origin => shared localStorage) ----
(function savedResults() {
  const rows = [];
  for (const id of ["baseline", ...ADAPTERS.map((a) => a.id)]) {
    try { const raw = localStorage.getItem("bench:" + id); if (raw) rows.push(JSON.parse(raw)); } catch {}
  }
  const wrap = $("#saved");
  if (!rows.length) { wrap.innerHTML = "<p>No saved results yet. Run the individual benchmark pages (see the index) and reload this page.</p>"; return; }
  const charts = [
    ["Initial render (ms)", (r) => r.initial.syncMs],
    ["Update median incl. layout (ms)", (r) => r.updateWithLayout.median],
    ["Update p95 incl. layout (ms)", (r) => r.updateWithLayout.p95],
    ["JavaScript shipped (KB, decoded)", (r) => r.resources.jsKB],
    ["Heap after updates (MB)", (r) => r.memory.heapAfterUpdatesMB],
    ["DOM nodes in board", (r) => r.domNodes],
  ];
  wrap.innerHTML = charts.map(([, ], i) => `<div class="chart" id="saved-${i}"></div>`).join("");
  charts.forEach(([title, get], i) => {
    const data = rows.filter((r) => get(r) != null && r.name !== "baseline").map((r) => ({ label: r.label, value: get(r) }));
    if (data.length) drawBars(`#saved-${i}`, title + " — lower is better", data);
  });
})();
