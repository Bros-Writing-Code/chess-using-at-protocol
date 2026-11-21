import { parseArgs } from 'node:util';
import { compareRuns, readRun } from './results.js';

try {
  const { values } = parseArgs({
    options: { before: { type: 'string' }, after: { type: 'string' } },
  });
  if (!values.before || !values.after) {
    throw new Error('Usage: npm run bench:compare -- --before file.json --after file.json');
  }
  console.table(compareRuns(readRun(values.before), readRun(values.after)));
  console.log('Speedup = before / after; above 1 is faster. Negative changePercent is faster.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
