import { readFileSync } from 'node:fs';
import { positions, statusCases } from './fixtures/positions.js';
import { perft } from './perft.js';

export const games = JSON.parse(
  readFileSync(new URL('./fixtures/games.json', import.meta.url), 'utf8'),
);
const task = (id, unit, workUnits, run, afterEach) => ({ id, unit, workUnits, run, afterEach });

function positionTasks(adapter) {
  return positions.flatMap((position) => {
    const state = adapter.load(position.fen);
    return [
      task(`perft/${position.id}/d${position.depth}`, 'tree', position.nodes, () =>
        perft(adapter, adapter.load(position.fen), position.depth),
      ),
      task(`legalMoves/${position.id}`, 'position', 1, () => adapter.moves(state)),
      task(`fen/load/${position.id}`, 'FEN', 1, () => adapter.load(position.fen)),
      task(`fen/save/${position.id}`, 'FEN', 1, () => adapter.fen(state)),
    ];
  });
}
function moveTasks(adapter, length) {
  const game = games.find((sample) => sample.moves.length > length);
  if (!game) {
    throw new Error(`No fixture has more than ${length} plies`);
  }
  const state = adapter.replay(game.moves.slice(0, length));
  const uci = adapter.moves(state).sort()[0];
  if (!uci) {
    throw new Error(`No legal move at history length ${length}`);
  }
  const tasks = [
    task(
      `applyMove/history${length}`,
      'move',
      1,
      () => adapter.move(state, uci),
      adapter.id === 'chessjs' ? () => state.undo() : undefined,
    ),
  ];
  for (const [kind, candidate] of [
    ['legal', uci],
    ['illegal', 'a1a1'],
    ['malformed', 'invalid'],
  ]) {
    const query = () => adapter.valid(state, candidate);
    const batchSize = 128;
    tasks.push({
      ...task(`isValidMove/history${length}/${kind}`, 'query', 1, () => {
        let accepted = 0;
        for (let i = 0; i < batchSize; i++) {
          accepted += Number(query());
        }
        return accepted;
      }),
      batchSize,
      query,
    });
  }
  return tasks;
}
export function workloads(adapter) {
  const tasks = [
    ...positionTasks(adapter),
    ...[0, 60].flatMap((length) => moveTasks(adapter, length)),
  ];
  for (const sample of statusCases) {
    const state = sample.moves ? adapter.replay(sample.moves) : adapter.load(sample.fen);
    tasks.push(task(`getGameStatus/${sample.id}`, 'position', 1, () => adapter.status(state)));
  }
  tasks.push(
    task(
      'replay/200-games',
      '200-game batch',
      games.reduce((n, game) => n + game.moves.length, 0),
      () => {
        for (const game of games) {
          adapter.replay(game.moves);
        }
      },
    ),
  );
  if (adapter.pgn) {
    tasks.push(
      task('pgn/replay/200-games', '200-game batch', 200, () => {
        for (const game of games) {
          adapter.pgn(game.pgn);
        }
      }),
    );
  }
  return tasks;
}
