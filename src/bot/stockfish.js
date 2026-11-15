// @ts-check
/**
 * stockfish.js — computer opponent for local "vs. Stockfish" games.
 *
 * Stockfish runs in the player's own browser as WebAssembly inside a Web
 * Worker, so the board never freezes while it thinks and no server is needed.
 * We talk to it with UCI, the standard text protocol for chess engines:
 *
 *   → position fen <fen>     (here is the board)
 *   → go movetime 600        (think for 600 ms)
 *   ← bestmove e7e5          (my move)
 *
 * This file lives outside src/engine on purpose: our engine is pure and
 * synchronous, while Stockfish is asynchronous and stateful. Stockfish only
 * suggests moves; the caller still plays them through the engine, which
 * validates every move.
 *
 * Stockfish is GPLv3. Its license ships next to the engine files in
 * src/bot/assets/stockfish/. The app serves those files (see README.md).
 */

/**
 * A difficulty: a preset name, a Stockfish skill level (0-20), or a target
 * rating (Elo 1320-3190). Skill and Elo suit a slider in the UI.
 *
 * @typedef {'easy' | 'medium' | 'hard' | 'max' | { skill: number, movetime?: number } | { elo: number, movetime?: number }} Level
 */

/** Stockfish's own limits for its strength settings. */
export const SKILL_RANGE = Object.freeze({ min: 0, max: 20 });
export const ELO_RANGE = Object.freeze({ min: 1320, max: 3190 });
const DEFAULT_MOVETIME = 1000;

/**
 * How strong each level plays. Skill Level is Stockfish's own 0-20 strength
 * setting; movetime is how long it thinks per move, in milliseconds.
 *
 * @type {Readonly<Record<'easy' | 'medium' | 'hard' | 'max', { skill: number, movetime: number }>>}
 */
export const LEVELS = Object.freeze({
  easy: { skill: 2, movetime: 300 },
  medium: { skill: 8, movetime: 600 },
  hard: { skill: 15, movetime: 1000 },
  // Full strength: far beyond any human player, even with the small build.
  max: { skill: 20, movetime: 2000 },
});

/**
 * Turns a Level into the UCI options to send, or an error message.
 *
 * @param {unknown} level
 * @returns {{ options: string[], movetime: number } | { error: string }}
 */
export function resolveLevel(level) {
  const inRange = (value, { min, max }) => Number.isInteger(value) && value >= min && value <= max;

  if (typeof level === 'string') {
    const preset = LEVELS[/** @type {keyof typeof LEVELS} */ (level)];
    if (!preset) return { error: `Unknown level: ${level}` };
    level = preset;
  }
  if (!level || typeof level !== 'object') return { error: `Unknown level: ${String(level)}` };

  const { skill, elo, movetime = DEFAULT_MOVETIME } = /** @type {any} */ (level);
  if (!Number.isInteger(movetime) || movetime < 50 || movetime > 10_000) {
    return { error: `movetime must be 50-10000 ms, got ${movetime}` };
  }
  if (elo !== undefined) {
    if (!inRange(elo, ELO_RANGE)) return { error: `elo must be ${ELO_RANGE.min}-${ELO_RANGE.max}, got ${elo}` };
    return {
      movetime,
      options: ['setoption name UCI_LimitStrength value true', `setoption name UCI_Elo value ${elo}`],
    };
  }
  if (!inRange(skill, SKILL_RANGE)) return { error: `skill must be ${SKILL_RANGE.min}-${SKILL_RANGE.max}, got ${skill}` };
  return {
    movetime,
    options: ['setoption name UCI_LimitStrength value false', `setoption name Skill Level value ${skill}`],
  };
}

/** Extra time to wait past movetime before telling Stockfish to stop. */
const STOP_GRACE_MS = 3000;
/** Extra time to wait after "stop" before giving up on an answer. */
const FAIL_GRACE_MS = 2000;

const BESTMOVE = /^bestmove\s+(\S+)/;
const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/**
 * Something Stockfish runs in: a Web Worker in the browser, or the npm
 * package in Node tests. Lines are UCI output, one per call.
 *
 * @typedef {Object} Transport
 * @property {(command: string) => void} send
 * @property {(onLine: (line: string) => void) => void} listen
 * @property {() => void} terminate
 */

/**
 * Default URL of the browser build: wherever the app serves the files in
 * src/bot/assets/stockfish/ (see README.md). Respects Vite's base path (e.g.
 * when deployed to GitHub Pages). Pass a different URL to
 * createWorkerTransport if the app serves them elsewhere.
 */
export function defaultWorkerUrl() {
  const base = /** @type {any} */ (import.meta).env?.BASE_URL ?? '/';
  return `${base}stockfish/stockfish-19-lite-single.js`;
}

/**
 * Runs Stockfish in a Web Worker (browser only).
 *
 * @param {string} [url] - Path to stockfish-19-lite-single.js.
 * @returns {Transport}
 */
export function createWorkerTransport(url = defaultWorkerUrl()) {
  const worker = new Worker(url);
  return {
    send: (command) => worker.postMessage(command),
    listen: (onLine) => {
      worker.onmessage = (event) => onLine(String(event.data));
    },
    terminate: () => worker.terminate(),
  };
}

/**
 * Creates a Stockfish opponent. Requests are answered one at a time, in the
 * order they were made.
 *
 * @param {{ transport?: Transport }} [options] - Inject a transport for tests;
 *   defaults to a Web Worker.
 * @example
 *   const bot = createStockfishBot();
 *   const uci = await bot.getBotMove(game.fen(), 'medium');  // e.g. "e7e5"
 *   game.move(uci);                                          // engine validates it
 */
export function createStockfishBot({ transport } = {}) {
  const io = transport ?? createWorkerTransport();

  /** @type {Array<(line: string) => boolean>} */
  let waiters = [];
  io.listen((line) => {
    // Hand each line to the first waiter that wants it.
    const index = waiters.findIndex((wants) => wants(line));
    if (index !== -1) waiters.splice(index, 1);
  });

  /**
   * Resolves with the first line that `match` accepts. `cancel` removes the
   * waiter, so a late answer from a timed-out search can't be mistaken for
   * the answer to the next one.
   *
   * @param {(line: string) => boolean} match
   * @returns {Promise<string> & { cancel: () => void }}
   */
  function waitFor(match) {
    /** @type {(line: string) => boolean} */
    let waiter = () => false;
    const promise = new Promise((resolve) => {
      waiter = (line) => {
        if (!match(line)) return false;
        resolve(line);
        return true;
      };
      waiters.push(waiter);
    });
    return Object.assign(promise, {
      cancel: () => { waiters = waiters.filter((w) => w !== waiter); },
    });
  }

  // UCI handshake, done once: "uci" → "uciok", then "isready" → "readyok".
  const ready = (async () => {
    const uciok = waitFor((line) => line === 'uciok');
    io.send('uci');
    await uciok;
    const readyok = waitFor((line) => line === 'readyok');
    io.send('isready');
    await readyok;
  })();

  /** Chain of requests, so concurrent calls never mix up their answers. */
  let queue = Promise.resolve();
  let terminated = false;
  let needsResync = false;

  /**
   * One search. Assumes the handshake is done and no other search is running.
   * @param {string} fen
   * @param {{ options: string[], movetime: number }} settings
   * @returns {Promise<string>}
   */
  async function search(fen, { options, movetime }) {
    if (needsResync) {
      // A previous search timed out and may still answer late. UCI handles
      // commands in order, so once "readyok" arrives any late "bestmove" has
      // already gone by (and was ignored, since nobody was waiting for it).
      const synced = waitFor((line) => line === 'readyok');
      io.send('stop');
      io.send('isready');
      await synced;
      needsResync = false;
    }

    const answer = waitFor((line) => BESTMOVE.test(line));
    options.forEach((option) => io.send(option));
    io.send(`position fen ${fen}`);
    io.send(`go movetime ${movetime}`);

    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let stopTimer;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let failTimer;
    const timedOut = new Promise((_, reject) => {
      stopTimer = setTimeout(() => {
        io.send('stop'); // ask for its best move so far
        failTimer = setTimeout(() => {
          needsResync = true;
          reject(new Error('Stockfish did not answer in time'));
        }, FAIL_GRACE_MS);
      }, movetime + STOP_GRACE_MS);
    });

    try {
      const line = await Promise.race([answer, timedOut]);
      const move = /** @type {RegExpMatchArray} */ (line.match(BESTMOVE))[1];
      if (move === '(none)') throw new Error('Stockfish has no legal move (game over)');
      if (!UCI_MOVE.test(move)) throw new Error(`Unexpected Stockfish move: ${move}`);
      return move;
    } finally {
      clearTimeout(stopTimer);
      clearTimeout(failTimer);
      answer.cancel();
    }
  }

  return {
    /**
     * Asks Stockfish for a move in the given position.
     *
     * @param {string} fen - Current position (e.g. game.fen()).
     * @param {Level} [level='medium'] - e.g. 'hard', { skill: 12 }, { elo: 1800 }
     * @returns {Promise<string>} A UCI move such as "e7e5" or "a7a8q".
     *   Rejects if the level is invalid, the bot was terminated, the game is
     *   already over, or Stockfish does not answer in time.
     */
    getBotMove(fen, level = 'medium') {
      const settings = resolveLevel(level);
      if ('error' in settings) return Promise.reject(new Error(settings.error));
      if (terminated) return Promise.reject(new Error('Stockfish was terminated'));
      if (typeof fen !== 'string' || fen.trim() === '') {
        return Promise.reject(new Error('A FEN string is required'));
      }

      const result = queue.then(() => ready).then(() => search(fen, settings));
      queue = result.catch(() => {}); // keep the chain going after a failure
      return result;
    },

    /** Stops Stockfish and frees its memory. Call when leaving the page. */
    terminate() {
      terminated = true;
      waiters = [];
      io.terminate();
    },
  };
}
