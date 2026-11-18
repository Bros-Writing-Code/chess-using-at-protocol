import { createRequire } from 'node:module';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createStockfishBot, resolveLevel, LEVELS, ELO_RANGE, SKILL_RANGE } from '../stockfish.js';
import { SQUARES, toSquare } from '../../engine/0x88helper.js';
import { moveGenerator } from '../../engine/moveGeneration.js';
import { FENtoGameState, moveToUCI } from '../../engine/notation.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Fake Stockfish for unit tests: records commands and lets each test decide
 * how to answer.
 */
function fakeTransport({ autoHandshake = true, answer } = {}) {
  let onLine = () => {};
  const sent = [];
  const emit = (line) => onLine(line);
  return {
    sent,
    emit,
    terminated: false,
    send(command) {
      sent.push(command);
      if (autoHandshake && command === 'uci') queueMicrotask(() => emit('uciok'));
      if (autoHandshake && command === 'isready') queueMicrotask(() => emit('readyok'));
      if (command.startsWith('go') && answer) queueMicrotask(() => answer(command, emit));
    },
    listen(callback) { onLine = callback; },
    onError(callback) { this.crash = callback; },
    terminate() { this.terminated = true; },
  };
}

/** Bot whose every (re)start uses the next transport in `list`. */
function botWith(...list) {
  let next = 0;
  return createStockfishBot({ createTransport: () => list[next++] });
}

describe('Stockfish adapter (fake engine)', () => {
  afterEach(() => vi.useRealTimers());

  it('does the UCI handshake once, then searches with the level settings', async () => {
    const io = fakeTransport({ answer: (_, emit) => emit('bestmove e7e5 ponder g1f3') });
    const bot = botWith(io);

    await expect(bot.getBotMove(START, 'easy')).resolves.toBe('e7e5');
    await expect(bot.getBotMove(START, 'hard')).resolves.toBe('e7e5');

    expect(io.sent.filter((c) => c === 'uci')).toHaveLength(1);
    expect(io.sent).toEqual([
      'uci', 'isready',
      'setoption name UCI_LimitStrength value false', `setoption name Skill Level value ${LEVELS.easy.skill}`,
      `position fen ${START}`, `go movetime ${LEVELS.easy.movetime}`,
      'setoption name UCI_LimitStrength value false', `setoption name Skill Level value ${LEVELS.hard.skill}`,
      `position fen ${START}`, `go movetime ${LEVELS.hard.movetime}`,
    ]);
  });

  it('supports an Elo target and a skill slider', async () => {
    const io = fakeTransport({ answer: (_, emit) => emit('bestmove c7c5') });
    const bot = botWith(io);
    await bot.getBotMove(START, { elo: 1800 });
    await bot.getBotMove(START, { skill: 12, movetime: 400 });
    expect(io.sent).toEqual(expect.arrayContaining([
      'setoption name UCI_LimitStrength value true', 'setoption name UCI_Elo value 1800', 'go movetime 1000',
      'setoption name UCI_LimitStrength value false', 'setoption name Skill Level value 12', 'go movetime 400',
    ]));
  });

  it.each([
    [{ elo: ELO_RANGE.min - 1 }, /elo must be/],
    [{ elo: ELO_RANGE.max + 1 }, /elo must be/],
    [{ elo: 1500.5 }, /elo must be/],
    [{ skill: SKILL_RANGE.max + 1 }, /skill must be/],
    [{ skill: -1 }, /skill must be/],
    [{ skill: 5, movetime: 0 }, /movetime/],
    [{}, /skill must be/],
    [null, /Unknown level/],
  ])('rejects out-of-range level %j', (level, message) => {
    expect(resolveLevel(level)).toEqual({ error: expect.stringMatching(message) });
  });

  it('defaults to medium', async () => {
    const io = fakeTransport({ answer: (_, emit) => emit('bestmove d7d5') });
    await botWith(io).getBotMove(START);
    expect(io.sent).toContain(`setoption name Skill Level value ${LEVELS.medium.skill}`);
  });

  it('ignores "info" lines and returns promotions with their piece letter', async () => {
    const io = fakeTransport({
      answer: (_, emit) => { emit('info depth 5 score cp 900'); emit('bestmove a7a8q'); },
    });
    await expect(botWith(io).getBotMove('8/P6k/8/8/8/8/8/K7 w - - 0 1')).resolves.toBe('a7a8q');
  });

  it('answers overlapping requests in order, one search at a time', async () => {
    let n = 0;
    const replies = ['bestmove e2e4', 'bestmove d2d4'];
    const io = fakeTransport({ answer: (_, emit) => setTimeout(() => emit(replies[n++]), 5) });
    const bot = botWith(io);

    const [first, second] = await Promise.all([bot.getBotMove(START), bot.getBotMove(START)]);
    expect([first, second]).toEqual(['e2e4', 'd2d4']);
  });

  it('rejects when the game is already over', async () => {
    const io = fakeTransport({ answer: (_, emit) => emit('bestmove (none)') });
    await expect(botWith(io).getBotMove(START)).rejects.toThrow(/no legal move/i);
  });

  it('rejects bad input without talking to Stockfish', async () => {
    const io = fakeTransport();
    const bot = botWith(io);
    await expect(bot.getBotMove(START, 'impossible')).rejects.toThrow(/Unknown level/);
    await expect(bot.getBotMove('')).rejects.toThrow(/FEN/);
    expect(io.sent.some((c) => c.startsWith('go'))).toBe(false);
  });

  it('sends "stop" when Stockfish runs long, then rejects if it never answers', async () => {
    vi.useFakeTimers();
    const io = fakeTransport(); // never answers "go"
    const bot = botWith(io);
    const move = bot.getBotMove(START, 'easy');
    const failed = expect(move).rejects.toThrow(/did not answer/);

    await vi.advanceTimersByTimeAsync(LEVELS.easy.movetime + 3000);
    expect(io.sent).toContain('stop');
    await vi.advanceTimersByTimeAsync(2000);
    await failed;
  });

  it('accepts the answer that "stop" produces', async () => {
    vi.useFakeTimers();
    const io = fakeTransport();
    const originalSend = io.send.bind(io);
    io.send = (command) => {
      originalSend(command);
      if (command === 'stop') queueMicrotask(() => io.emit('bestmove g8f6'));
    };
    const move = botWith(io).getBotMove(START, 'easy');
    await vi.advanceTimersByTimeAsync(LEVELS.easy.movetime + 3000);
    await expect(move).resolves.toBe('g8f6');
  });

  it('restarts Stockfish after a timeout, so a late answer cannot leak into the next search', async () => {
    vi.useFakeTimers();
    const stuck = fakeTransport(); // never answers "go"
    const fresh = fakeTransport({ answer: (_, emit) => emit('bestmove d7d5') });
    const bot = botWith(stuck, fresh);

    const first = bot.getBotMove(START, 'easy');
    const firstFailed = expect(first).rejects.toThrow(/did not answer/);
    await vi.advanceTimersByTimeAsync(LEVELS.easy.movetime + 5000);
    await firstFailed;
    expect(stuck.terminated).toBe(true);

    stuck.emit('bestmove h7h6'); // the old engine's late answer goes nowhere
    await expect(bot.getBotMove(START, 'easy')).resolves.toBe('d7d5');
    expect(fresh.sent[0]).toBe('uci'); // a brand-new handshake
  });

  it('rejects if Stockfish never finishes starting, then retries with a fresh one', async () => {
    vi.useFakeTimers();
    const silent = fakeTransport({ autoHandshake: false });
    const working = fakeTransport({ answer: (_, emit) => emit('bestmove e7e6') });
    const bot = botWith(silent, working);

    const first = bot.getBotMove(START);
    const failed = expect(first).rejects.toThrow(/failed to start/);
    await vi.advanceTimersByTimeAsync(15_000);
    await failed;
    expect(silent.terminated).toBe(true);
    expect(silent.sent.some((c) => c.startsWith('go'))).toBe(false);

    await expect(bot.getBotMove(START)).resolves.toBe('e7e6');
  });

  it('rejects right away if the Worker fails to load', async () => {
    const broken = fakeTransport({ autoHandshake: false });
    const bot = botWith(broken);
    const move = bot.getBotMove(START);
    await vi.waitFor(() => expect(broken.crash).toBeTypeOf('function')); // worker created
    broken.crash(new Error('Stockfish worker error: failed to load'));
    await expect(move).rejects.toThrow(/failed to load/);
    expect(broken.terminated).toBe(true);
  });

  it('rejects the current search if the Worker crashes mid-search, then restarts', async () => {
    const crashing = fakeTransport({
      answer: () => queueMicrotask(() => crashing.crash(new Error('Stockfish worker error: out of memory'))),
    });
    const working = fakeTransport({ answer: (_, emit) => emit('bestmove g8f6') });
    const bot = botWith(crashing, working);

    await expect(bot.getBotMove(START)).rejects.toThrow(/out of memory/);
    await expect(bot.getBotMove(START)).resolves.toBe('g8f6');
  });

  it('keeps the same Stockfish after a normal "game over" answer', async () => {
    let created = 0;
    const io = fakeTransport({ answer: (_, emit) => emit('bestmove (none)') });
    const bot = createStockfishBot({ createTransport: () => { created += 1; return io; } });
    await expect(bot.getBotMove(START)).rejects.toThrow(/no legal move/);
    await expect(bot.getBotMove(START)).rejects.toThrow(/no legal move/);
    expect(created).toBe(1);
    expect(io.terminated).toBe(false);
  });

  it('stops working after terminate()', async () => {
    const io = fakeTransport({ answer: (_, emit) => emit('bestmove e7e5') });
    const bot = botWith(io);
    await bot.getBotMove(START);
    bot.terminate();
    expect(io.terminated).toBe(true);
    await expect(bot.getBotMove(START)).rejects.toThrow(/terminated/);
  });
});

/** Runs the real Stockfish WASM build in Node, through the npm package. */
function nodeTransport() {
  const require = createRequire(import.meta.url);
  const init = require('stockfish');
  let onLine = () => {};
  const engine = init('lite-single', (line) => onLine(line));
  return {
    send: (command) => engine.processCommand(command),
    listen: (callback) => { onLine = callback; },
    terminate: () => engine.terminate(),
  };
}

/** Every legal UCI move in a position, from our own engine. */
function legalMoves(fen) {
  const state = FENtoGameState(fen);
  const moves = [];
  for (const index of SQUARES) {
    const piece = state.board[index];
    if (!piece || piece.color !== state.currentTurn) continue;
    const from = toSquare(index);
    for (const to of moveGenerator(state, from)) {
      const uci = moveToUCI({ from, to });
      const promotes = piece.type === 'p' && (to.row === 0 || to.row === 7);
      moves.push(...(promotes ? ['q', 'r', 'b', 'n'].map((p) => uci + p) : [uci]));
    }
  }
  return moves;
}

describe('Stockfish adapter (real engine)', () => {
  const bot = createStockfishBot({ createTransport: nodeTransport });

  it.each(['easy', 'medium', 'hard', 'max'])('returns a legal move at %s level', async (level) => {
    const move = await bot.getBotMove(START, level);
    expect(legalMoves(START)).toContain(move);
  }, 15_000);

  it('accepts the full Elo range', async () => {
    for (const elo of [ELO_RANGE.min, ELO_RANGE.max]) {
      expect(legalMoves(START)).toContain(await bot.getBotMove(START, { elo, movetime: 200 }));
    }
  }, 15_000);

  it('finds mate in one', async () => {
    // White plays Qh5xf7#: the classic Scholar's Mate finish.
    const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    await expect(bot.getBotMove(fen, 'hard')).resolves.toBe('h5f7');
  }, 15_000);

  it('plays a legal move for Black and in an endgame', async () => {
    const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    expect(legalMoves(afterE4)).toContain(await bot.getBotMove(afterE4, 'easy'));
    const endgame = '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1';
    expect(legalMoves(endgame)).toContain(await bot.getBotMove(endgame, 'easy'));
  }, 15_000);
});
