// @ts-check
import {
  createGame as createEngineGame,
  applyMove,
  legalMoves as engineLegalMoves,
  isInCheck,
  GameStatetoFEN,
} from '../../engine/index.js';

/** @typedef {import('../../engine/types.js').Result<string>} MoveResult */
/** @typedef {import('../../engine/types.js').GameStatus} GameStatus */
/** @typedef {import('../../engine/types.js').DrawReason} DrawReason */

/**
 * @typedef {Object} Status
 * @property {GameStatus} status
 * @property {ColorName | null} winner
 * @property {DrawReason | null} drawReason
 * @property {boolean} inCheck
 */

/** @typedef {import('./clock.js').ColorName} ColorName */

/** @type {Record<'w' | 'b', ColorName>} */
const COLOR_NAMES = { w: 'white', b: 'black' };
const DEFAULT_PROMOTION = 'q';

/**
 * Creates a game that wraps the engine's game state.
 * The state is kept so threefold repetition can see earlier positions.
 *
 * @param {string} [startFen] - Starting position. Defaults to the normal start.
 */
export function createGame(startFen) {
  let state = createEngineGame(startFen);

  /** @returns {ColorName} */
  function turn() {
    return COLOR_NAMES[state.currentTurn];
  }

  /**
   * @returns {Status} Whether the game is over, and why.
   */
  function status() {
    return {
      status: state.status,
      winner: state.winner ? COLOR_NAMES[state.winner] : null,
      drawReason: state.drawReason,
      inCheck: isInCheck(state),
    };
  }

  return {
    /**
     * @returns {string} The current position as a FEN string.
     */
    fen() {
      return GameStatetoFEN(state);
    },

    turn,

    legalMoves() {
      /** @type {Map<string, string[]>} */
      const targets = new Map();
      for (const uci of engineLegalMoves(state)) {
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const tos = targets.get(from) ?? [];
        if (!tos.includes(to)) {
          tos.push(to);
        }
        targets.set(from, tos);
      }
      return targets;
    },

    /**
     * Plays a move. A promotion with no piece letter becomes a queen.
     * The game is unchanged when the move is illegal.
     *
     * @param {string} uci - A move such as `e2e4` or `a7b8q`.
     * @returns {MoveResult}
     */
    move(uci) {
      const withQueen = uci + DEFAULT_PROMOTION;
      const toPlay = engineLegalMoves(state).includes(withQueen) ? withQueen : uci;
      const result = applyMove(state, toPlay);
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      state = result.value;
      return { ok: true, value: GameStatetoFEN(state) };
    },

    status,
  };
}
