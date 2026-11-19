// @ts-check
import { Chessground } from '@lichess-org/chessground';
import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './style.css';
import { createStockfishBot } from '../../bot/stockfish.js';
import { COLORS, createClock } from './clock.js';
import { createGame } from './game.js';

const INITIAL_SECONDS = 600;
const TICK_MS = 100;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

/** @typedef {import('./clock.js').ColorName} ColorName */

/** @typedef {import('@lichess-org/chessground/types').Key} Key */

/** @type {Record<ColorName, string>} */
const COLOR_LABELS = { white: 'White', black: 'Black' };
/** @type {Record<ColorName, ColorName>} */
const OPPONENTS = { white: 'black', black: 'white' };
/** @type {Record<string, string>} */
const DRAW_TEXTS = {
  stalemate: 'Draw by stalemate.',
  'threefold-repetition': 'Draw by threefold repetition.',
  'fifty-move-rule': 'Draw by the fifty-move rule.',
  'insufficient-material': 'Draw by insufficient material.',
};

const statusElement = document.getElementById('status');
const boardElement = document.getElementById('board');
const newGameButton = document.getElementById('new-game');
const resignGameButton = document.getElementById('resign');
/** @type {Record<ColorName, HTMLElement | null>} */
const clockElements = {
  white: document.getElementById('white-clock'),
  black: document.getElementById('black-clock'),
};

const clock = createClock({
  initialSeconds: INITIAL_SECONDS,
  now: () => Date.now(),
});
/** @type {ReturnType<typeof createGame>} */
let game;
let gameOver = false;
/** @type {ColorName | null} */
let timeLoser = null;
/** @type {ColorName | null} */
let resignedColor = null;
/** @type {Key[] | undefined} */
let lastMove;
/** @type {"bot" | "pvp"} */
let mode = 'pvp';
/** @type {ReturnType<typeof createStockfishBot> | null} */
let bot = null;
/** @type {"easy" | "medium" | "hard" | "max"} */
let botLvl = 'easy';
/** @type {ColorName | "white" | "black"} */
let humanColor = 'white';
/** @type {number} */
let gameId = 0;

const ground = Chessground(boardElement, {
  orientation: 'white',
  movable: { free: false, events: { after: onMove } },
  premovable: { enabled: false },
});

/** Makes the board match the game. */
function syncBoard() {
  const turn = game.turn();
  const dests = /** @type {Map<Key, Key[]>} */ (game.legalMoves());
  ground.set({
    fen: game.fen(),
    turnColor: turn,
    check: game.status().inCheck,
    lastMove,
    movable: { color: whoCanMove(), dests },
  });
}

/**
 * @param {number} ms
 * @returns {string} The time as m:ss, rounded up to the next second.
 */
function formatTime(ms) {
  const totalSeconds = Math.ceil(ms / MS_PER_SECOND);
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = String(totalSeconds % SECONDS_PER_MINUTE).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function renderClocks() {
  for (const color of COLORS) {
    clockElements[color].textContent = formatTime(clock.remaining(color));
  }
}

/** @returns {string} The status line text for the current situation. */
function statusText() {
  if (timeLoser) {
    return `${COLOR_LABELS[OPPONENTS[timeLoser]]} wins on time.`;
  }
  if (resignedColor) {
    return `${COLOR_LABELS[OPPONENTS[resignedColor]]} wins by resignation.`;
  }
  const { status, winner, drawReason, inCheck } = game.status();
  if (status === 'checkmate') {
    return `Checkmate. ${COLOR_LABELS[winner]} wins.`;
  }
  if (drawReason) {
    return DRAW_TEXTS[drawReason];
  }
  const text = `${COLOR_LABELS[game.turn()]} to move`;
  return inCheck ? `${text}, in check` : text;
}

function renderStatus() {
  statusElement.textContent = statusText();
}

function endGame() {
  clock.stop();
  ground.stop();
  gameOver = true;
  renderStatus();
}

function endOnTime() {
  timeLoser = clock.flagged();
  endGame();
}

/**
 * @param {Key} from
 * @param {Key} to
 */
function onMove(from, to) {
  play(from, to);
}

async function playBotMove() {
  const thisGame = gameId;
  bot ??= createStockfishBot();
  try {
    const uci = await bot.getBotMove(game.fen(), botLvl);
    if (thisGame !== gameId || gameOver) {
      return;
    } // new game or game ended while thinking
    play(uci.slice(0, 2), uci.slice(2, 4));
  } catch (error) {
    console.error(error);
    statusElement.textContent = 'The bot failed to move. Start a new game.';
  }
}

/**
 * @param {Key} from
 * @param {Key} to
 */
function play(from, to) {
  if (clock.flagged()) {
    syncBoard();
    endOnTime();
    return;
  }
  const result = game.move(from + to);
  if (result.ok === false) {
    console.error(result.error);
    syncBoard();
    return;
  }
  lastMove = [from, to];
  syncBoard();
  if (game.status().status === 'active') {
    clock.start(game.turn());
    renderStatus();
    if (mode === 'bot' && game.turn() !== humanColor) {
      playBotMove();
    }
  } else {
    endGame();
  }
}

function whoCanMove() {
  if (mode === 'pvp') {
    return game.turn();
  }
  if (game.turn() === humanColor) {
    return humanColor;
  }
  return undefined;
}

function startNewGame() {
  game = createGame();
  gameId = gameId + 1;
  clock.reset();
  gameOver = false;
  timeLoser = null;
  resignedColor = null;
  lastMove = undefined;
  ground.cancelMove();
  ground.set({ orientation: mode === 'bot' ? humanColor : 'white' });
  syncBoard();
  renderStatus();
  renderClocks();
  if (mode === 'bot' && game.turn() !== humanColor) {
    playBotMove();
  }
}

function resignGame() {
  if (!gameOver) {
    // In bot mode only the human can press Resign, even on the bot's turn.
    resignedColor = mode === 'bot' ? humanColor : game.turn();
    endGame();
  }
}

const modeOptions = document.getElementById('mode-options');

modeOptions?.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) {
    return;
  }

  mode = button.dataset.mode;

  if (button.dataset.level) {
    botLvl = button.dataset.level;
  }

  for (const other of modeOptions.querySelectorAll('button')) {
    other.setAttribute('aria-pressed', String(other === button));
  }
  startNewGame();
});

const HumanOptions = document.getElementById('color-options');

HumanOptions?.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) {
    return;
  }

  humanColor = button.dataset.color;

  for (const other of HumanOptions.querySelectorAll('button')) {
    other.setAttribute('aria-pressed', String(other === button));
  }
  startNewGame();
});

resignGameButton.addEventListener('click', resignGame);

setInterval(() => {
  renderClocks();
  if (!gameOver && clock.flagged()) {
    endOnTime();
  }
}, TICK_MS);

newGameButton.addEventListener('click', startNewGame);
startNewGame();
