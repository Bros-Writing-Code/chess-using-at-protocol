import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { moveUci, uciObject } from '../adapters/chessjs.js';

const directory = fileURLToPath(new URL('../fixtures/', import.meta.url));
let seed = 2100050;
function random() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 4294967296;
}
const games = [];
for (let i = 0; i < 200; i++) {
  const chess = new Chess();
  const moves = [];
  const maxPlies = 40 + (i % 5) * 20;
  while (moves.length < maxPlies && !chess.isGameOver()) {
    const choices = chess.moves({ verbose: true }).map(moveUci).sort();
    const uci = choices[Math.floor(random() * choices.length)];
    moves.push(uci);
    chess.move(uciObject(uci));
  }
  games.push({
    moves,
    fen: chess.fen({ forceEnpassantSquare: true }),
    pgn: chess.pgn(),
    termination: chess.isGameOver() ? 'game-over' : 'ply-cap',
  });
}
mkdirSync(directory, { recursive: true });
const data = JSON.stringify(games, null, 2) + '\n';
writeFileSync(directory + 'games.json', data);
writeFileSync(
  directory + 'manifest.json',
  JSON.stringify(
    {
      version: 1,
      seed: 2100050,
      algorithm: 'xorshift32',
      generator: 'chess.js 1.4.0',
      games: 200,
      maxPlies: [40, 60, 80, 100, 120],
      selection: 'sorted UCI, floor(random * count)',
      sha256: createHash('sha256').update(data).digest('hex'),
    },
    null,
    2,
  ) + '\n',
);
console.log('Generated 200 fixed games. Regenerating changes the comparison dataset.');
