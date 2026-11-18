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
    if (!preset) {
      return { error: `Unknown level: ${level}` };
    }
    level = preset;
  }
  if (!level || typeof level !== 'object') {
    return { error: `Unknown level: ${String(level)}` };
  }

  const { skill, elo, movetime = DEFAULT_MOVETIME } = /** @type {any} */ (level);
  if (!Number.isInteger(movetime) || movetime < 50 || movetime > 10_000) {
    return { error: `movetime must be 50-10000 ms, got ${movetime}` };
  }
  if (elo !== undefined) {
    if (!inRange(elo, ELO_RANGE)) {
      return { error: `elo must be ${ELO_RANGE.min}-${ELO_RANGE.max}, got ${elo}` };
    }
    return {
      movetime,
      options: [
        'setoption name UCI_LimitStrength value true',
        `setoption name UCI_Elo value ${elo}`,
      ],
    };
  }
  if (!inRange(skill, SKILL_RANGE)) {
    return { error: `skill must be ${SKILL_RANGE.min}-${SKILL_RANGE.max}, got ${skill}` };
  }
  return {
    movetime,
    options: [
      'setoption name UCI_LimitStrength value false',
      `setoption name Skill Level value ${skill}`,
    ],
  };
}

/** Extra time to wait past movetime before telling Stockfish to stop. */
const STOP_GRACE_MS = 3000;
/** Extra time to wait after "stop" before giving up on an answer. */
const FAIL_GRACE_MS = 2000;
/** How long Stockfish may take to load and answer the UCI handshake. */
const STARTUP_TIMEOUT_MS = 15000;

const BESTMOVE = /^bestmove\s+(\S+)/;
const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/**
 * Something Stockfish runs in: a Web Worker in the browser, or the npm
 * package in Node tests. Lines are UCI output, one per call.
 *
 * @typedef {Object} Transport
 * @property {(command: string) => void} send
 * @property {(onLine: (line: string) => void) => void} listen
 * @property {(onError: (error: Error) => void) => void} [onError]
 *   Called if the engine crashes or fails to load (optional).
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
    onError: (onError) => {
      worker.onerror = (event) => {
        event.preventDefault?.();
        onError(new Error(`Stockfish worker error: ${event.message || 'failed to load'}`));
      };
      worker.onmessageerror = () =>
        onError(new Error('Stockfish worker sent an unreadable message'));
    },
    terminate: () => worker.terminate(),
  };
}

/**
 * Rejects after `ms` with `message`. Returns the promise and a cancel function.
 * @param {number} ms
 * @param {string} message
 */
function deadline(ms, message) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  const promise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return { promise, cancel: () => clearTimeout(timer) };
}

/**
 * Creates a Stockfish opponent. Requests are answered one at a time, in the
 * order they were made.
 *
 * If Stockfish fails to start, crashes, or stops answering, the current
 * request rejects and the Worker is thrown away; the next request starts a
 * fresh one. A late answer from the old Worker can therefore never be
 * mistaken for the answer to a new position.
 *
 * @param {{ createTransport?: () => Transport }} [options] - Inject a
 *   transport factory for tests; defaults to a new Web Worker each time.
 * @example
 *   const bot = createStockfishBot();
 *   const uci = await bot.getBotMove(game.fen(), 'medium');  // e.g. "e7e5"
 *   game.move(uci);                                          // engine validates it
 */
export function createStockfishBot({ createTransport = () => createWorkerTransport() } = {}) {
  /**
   * One running Stockfish instance and everything tied to it.
   * @typedef {Object} Engine
   * @property {Transport} io
   * @property {Array<(line: string) => boolean>} waiters
   * @property {Promise<never>} crashed - Rejects if the engine reports an error.
   * @property {Promise<void>} ready - Resolves after the UCI handshake.
   */

  /** @type {Engine | null} */
  let engine = null;
  let terminated = false;

  /**
   * Resolves with the first line from `target` that `match` accepts. `cancel`
   * removes the waiter if the caller gives up.
   *
   * @param {Engine} target
   * @param {(line: string) => boolean} match
   * @returns {Promise<string> & { cancel: () => void }}
   */
  function waitFor(target, match) {
    /** @type {(line: string) => boolean} */
    let waiter = () => false;
    const promise = new Promise((resolve) => {
      waiter = (line) => {
        if (!match(line)) {
          return false;
        }
        resolve(line);
        return true;
      };
      target.waiters.push(waiter);
    });
    return Object.assign(promise, {
      cancel: () => {
        target.waiters = target.waiters.filter((w) => w !== waiter);
      },
    });
  }

  /** Starts a fresh Stockfish and its UCI handshake. */
  function start() {
    const io = createTransport();
    /** @type {(error: Error) => void} */
    let fail = () => {};
    /** @type {Engine} */
    const fresh = {
      io,
      waiters: [],
      crashed: new Promise((_, reject) => {
        fail = reject;
      }),
      ready: Promise.resolve(),
    };
    fresh.crashed.catch(() => {}); // only observed while a request is running

    io.listen((line) => {
      // Hand each line to the first waiter that wants it.
      const index = fresh.waiters.findIndex((wants) => wants(line));
      if (index !== -1) {
        fresh.waiters.splice(index, 1);
      }
    });
    io.onError?.((error) => fail(error));

    // UCI handshake: "uci" → "uciok", then "isready" → "readyok".
    const handshake = (async () => {
      const uciok = waitFor(fresh, (line) => line === 'uciok');
      io.send('uci');
      await uciok;
      const readyok = waitFor(fresh, (line) => line === 'readyok');
      io.send('isready');
      await readyok;
    })();
    const limit = deadline(STARTUP_TIMEOUT_MS, 'Stockfish failed to start in time');
    fresh.ready = Promise.race([handshake, fresh.crashed, limit.promise]).finally(limit.cancel);

    return fresh;
  }

  /** Throws away the current Stockfish; the next request starts a new one. */
  function discard() {
    if (!engine) {
      return;
    }
    engine.waiters = [];
    engine.io.terminate();
    engine = null;
  }

  /**
   * One search on a ready engine.
   * @param {Engine} current
   * @param {string} fen
   * @param {{ options: string[], movetime: number }} settings
   * @returns {Promise<string>}
   */
  async function search(current, fen, { options, movetime }) {
    const answer = waitFor(current, (line) => BESTMOVE.test(line));
    options.forEach((option) => current.io.send(option));
    current.io.send(`position fen ${fen}`);
    current.io.send(`go movetime ${movetime}`);

    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let stopTimer;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let failTimer;
    const timedOut = new Promise((_, reject) => {
      stopTimer = setTimeout(() => {
        current.io.send('stop'); // ask for its best move so far
        failTimer = setTimeout(
          () => reject(new Error('Stockfish did not answer in time')),
          FAIL_GRACE_MS,
        );
      }, movetime + STOP_GRACE_MS);
    });

    try {
      const line = await Promise.race([answer, timedOut, current.crashed]);
      const move = /** @type {RegExpMatchArray} */ (line.match(BESTMOVE))[1];
      if (move === '(none)') {
        throw new Error('Stockfish has no legal move (game over)');
      }
      if (!UCI_MOVE.test(move)) {
        throw new Error(`Unexpected Stockfish move: ${move}`);
      }
      return move;
    } finally {
      clearTimeout(stopTimer);
      clearTimeout(failTimer);
      answer.cancel();
    }
  }

  /**
   * Starts Stockfish if needed, waits for the handshake, then searches.
   * Restarts on the next call if this engine fails to start, crashes, or hangs.
   *
   * @param {string} fen
   * @param {{ options: string[], movetime: number }} settings
   */
  async function run(fen, settings) {
    if (terminated) {
      throw new Error('Stockfish was terminated');
    }
    if (!engine) {
      engine = start();
    }
    const current = engine;
    try {
      await current.ready;
      return await search(current, fen, settings);
    } catch (error) {
      const message = /** @type {Error} */ (error).message;
      // A finished game is a normal answer; anything else means this engine is unreliable.
      if (!/no legal move|Unexpected Stockfish move/.test(message) && engine === current) {
        discard();
      }
      throw error;
    }
  }

  /** Chain of requests, so concurrent calls never mix up their answers. */
  let queue = Promise.resolve();

  return {
    /**
     * Asks Stockfish for a move in the given position.
     *
     * @param {string} fen - Current position (e.g. game.fen()).
     * @param {Level} [level='medium'] - e.g. 'hard', { skill: 12 }, { elo: 1800 }
     * @returns {Promise<string>} A UCI move such as "e7e5" or "a7a8q".
     *   Rejects if the level is invalid, the bot was terminated, the game is
     *   already over, or Stockfish fails to start, crashes, or does not answer
     *   in time (the next call then starts a fresh Stockfish).
     */
    getBotMove(fen, level = 'medium') {
      const settings = resolveLevel(level);
      if ('error' in settings) {
        return Promise.reject(new Error(settings.error));
      }
      if (terminated) {
        return Promise.reject(new Error('Stockfish was terminated'));
      }
      if (typeof fen !== 'string' || fen.trim() === '') {
        return Promise.reject(new Error('A FEN string is required'));
      }

      const result = queue.then(() => run(fen, settings));
      queue = result.catch(() => {}); // keep the chain going after a failure
      return result;
    },

    /** Stops Stockfish and frees its memory. Call when leaving the page. */
    terminate() {
      terminated = true;
      discard();
    },
  };
}
