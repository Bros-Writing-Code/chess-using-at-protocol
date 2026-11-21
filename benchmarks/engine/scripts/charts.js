import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { taskPrefixes } from '../settings.js';
import { compatibility, readRuns } from './results.js';

const titles = {
  perft: 'Perft',
  applyMove: 'Apply move',
  legalMoves: 'Legal moves',
  isValidMove: 'Validate move',
  getGameStatus: 'Game status',
  replay: 'Move replay',
  fen: 'FEN load / save',
  pgn: 'PGN replay',
};
const escape = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const text = (x, y, value, extra = '') =>
  `<text x="${x}" y="${y}" ${extra}>${escape(value)}</text>`;
const label = (run) =>
  typeof run.metadata.label === 'string' && run.metadata.label.trim()
    ? run.metadata.label.trim()
    : 'Unlabeled';
const hash = (value) => createHash('sha256').update(value).digest('hex').slice(0, 12);

function runLabel(run, y) {
  // Wrap instead of replacing labels with commit IDs or truncating their names.
  const lines = [''];
  let columns = 0;
  for (const character of label(run)) {
    const width = character.codePointAt(0) > 255 ? 2 : 1;
    if (columns + width > 48) {
      lines.push('');
      columns = 0;
    }
    lines[lines.length - 1] += character;
    columns += width;
  }
  return {
    height: Math.max(1, lines.length) * 19,
    body: lines.map((line, i) => text(28, y + i * 19, line)).join(''),
  };
}
function panel(group, task, startY) {
  const points = group
    .map((run) => ({ run, rows: run.results.filter((row) => row.task === task) }))
    .filter((point) => point.rows.length);
  const max = Math.max(...points.flatMap((point) => point.rows.map((row) => row.medianMs)));
  let y = startY + 42;
  let body = text(24, startY, task, 'class="panel"');
  for (const point of points) {
    const name = runLabel(point.run, y);
    const rowStart = y;
    body += name.body;
    for (const row of point.rows) {
      const color = row.engine === 'ours' ? '#2563eb' : '#db6b16';
      body += `<rect x="420" y="${y - 14}" width="${(row.medianMs / max) * 700}" height="18" fill="${color}"/>`;
      body += text(
        1140,
        y,
        `${row.engine === 'ours' ? 'ours' : 'chess.js'} ${row.medianMs.toPrecision(5)} ms`,
      );
      y += 25;
    }
    const ours = point.rows.find((row) => row.engine === 'ours');
    const reference = point.rows.find((row) => row.engine === 'chessjs');
    if (ours && reference) {
      body += text(420, y, `ours/chess.js = ${(ours.medianMs / reference.medianMs).toFixed(4)}`);
      y += 23;
    }
    y = Math.max(y, rowStart + name.height) + 20;
  }
  body += `<path d="M24 ${y}H1376" stroke="#dde3ec"/>`;
  return { body, endY: y + 35 };
}
function categoryChart(group, category, tasks) {
  const m = group[0].metadata;
  const subtitle = `${m.method} | ${m.machine.cpu} | ${m.node} | ${m.settings.quick ? 'QUICK CHECK' : 'formal'} | lower ms is faster`;
  let body = '',
    y = 116;
  for (const task of tasks) {
    const section = panel(group, task, y);
    body += section.body;
    y = section.endY;
  }
  const title = titles[category] || category;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="${y}" viewBox="0 0 1400 ${y}"><rect width="100%" height="100%" fill="white"/><style>text{font:14px sans-serif;fill:#172b4d}.title{font-size:22px;font-weight:bold}.panel{font-size:17px;font-weight:bold}</style>${text(24, 32, title, 'class="title"')}${text(24, 58, subtitle)}${text(24, 82, 'Runs ordered by measurement time; each scenario has its own scale.')}${body}</svg>`;
}
function writeGroup(group, tasks, output, selection) {
  const available = tasks.filter((task) =>
    group.some((run) => run.results.some((row) => row.task === task)),
  );
  if (!available.length) {
    return;
  }
  const signature = 'category-charts-v1' + compatibility(group[0]) + JSON.stringify(selection);
  const directory = resolve(output, 'group-' + hash(signature));
  mkdirSync(directory, { recursive: true });
  const categories = Map.groupBy(available, (task) => task.split('/')[0]);
  for (const [category, members] of categories) {
    const filename = /^[a-zA-Z][a-zA-Z0-9]*$/.test(category)
      ? category
      : 'category-' + hash(category);
    writeFileSync(resolve(directory, filename + '.svg'), categoryChart(group, category, members));
  }
  writeFileSync(
    resolve(directory, 'runs.json'),
    JSON.stringify(
      group.map((run) => ({ runId: run.runId, metadata: run.metadata })),
      null,
      2,
    ) + '\n',
  );
  console.log(`Wrote ${categories.size} category charts to ${directory}`);
}
function main() {
  const { values } = parseArgs({
    options: {
      all: { type: 'boolean' },
      input: { type: 'string', default: 'benchmarks/engine/results' },
      output: { type: 'string', default: 'benchmarks/engine/charts' },
      runs: { type: 'string', multiple: true },
      tasks: { type: 'string', multiple: true },
    },
  });
  if (Boolean(values.all) === Boolean(values.runs?.length)) {
    throw new Error('Choose --all or repeat --runs <run-id>');
  }
  if (values.runs?.some((id) => !id.trim())) {
    throw new Error('Run IDs must not be empty');
  }
  const runs = readRuns(values.input, values.runs).sort(
    (a, b) => a.metadata.date.localeCompare(b.metadata.date) || a.runId.localeCompare(b.runId),
  );
  if (!runs.length) {
    throw new Error('No saved results found');
  }
  const prefixes = taskPrefixes(values.tasks || []);
  const available = [...new Set(runs.flatMap((run) => run.results.map((row) => row.task)))].sort();
  for (const prefix of prefixes) {
    if (!available.some((task) => task.startsWith(prefix))) {
      throw new Error(`Unknown task prefix: ${prefix}`);
    }
  }
  const tasks = available.filter(
    (task) => !prefixes.length || prefixes.some((prefix) => task.startsWith(prefix)),
  );
  for (const group of Map.groupBy(runs, compatibility).values()) {
    writeGroup(group, tasks, values.output, {
      runs: values.all ? 'all' : [...new Set(values.runs)].sort(),
      tasks: prefixes,
    });
  }
}
try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
