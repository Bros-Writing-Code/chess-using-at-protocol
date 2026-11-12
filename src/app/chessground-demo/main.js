// @ts-check
import { Chessground } from '@lichess-org/chessground';
import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './style.css';
import { createGame } from './game.js';
import { COLORS, createClock } from './clock.js';

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
/** @type {Key[] | undefined} */
let lastMove;

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
    movable: { color: turn, dests },
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
  if (timeLoser) return `${COLOR_LABELS[OPPONENTS[timeLoser]]} wins on time.`;
  const { status, winner, drawReason, inCheck } = game.status();
  if (status === 'checkmate') return `Checkmate. ${COLOR_LABELS[winner]} wins.`;
  if (drawReason) return DRAW_TEXTS[drawReason];
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
  } else {
    endGame();
  }
}

function startNewGame() {
  game = createGame();
  clock.reset();
  gameOver = false;
  timeLoser = null;
  lastMove = undefined;
  ground.cancelMove();
  syncBoard();
  renderStatus();
  renderClocks();
}

setInterval(() => {
  renderClocks();
  if (!gameOver && clock.flagged()) endOnTime();
}, TICK_MS);

newGameButton.addEventListener('click', startNewGame);
startNewGame();
