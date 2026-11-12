// @ts-check
import { Chess } from 'chess.js';

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
 * Creates a game that wraps a single chess.js instance.
 * The instance is kept so threefold repetition can see earlier positions.
 *
 * @param {string} [startFen] - Starting position. Defaults to the normal start.
 */
export function createGame(startFen) {
  const chess = new Chess(startFen);

  /** @returns {ColorName} */
  function turn() {
    return COLOR_NAMES[chess.turn()];
  }

  /**
   * @returns {Status} Whether the game is over, and why.
   */
  function status() {
    const inCheck = chess.isCheck();
    if (chess.isCheckmate()) {
      const winner = turn() === 'white' ? 'black' : 'white';
      return { status: 'checkmate', winner, drawReason: null, inCheck };
    }
    const drawReason = findDrawReason();
    if (drawReason === 'stalemate') {
      return { status: 'stalemate', winner: null, drawReason, inCheck };
    }
    if (drawReason) {
      return { status: 'draw', winner: null, drawReason, inCheck };
    }
    return { status: 'active', winner: null, drawReason: null, inCheck };
  }

  /** @returns {DrawReason | null} */
  function findDrawReason() {
    if (chess.isStalemate()) return 'stalemate';
    if (chess.isInsufficientMaterial()) return 'insufficient-material';
    if (chess.isThreefoldRepetition()) return 'threefold-repetition';
    if (chess.isDrawByFiftyMoves()) return 'fifty-move-rule';
    return null;
  }

  return {
    /**
     * @returns {string} The current position as a FEN string.
     */
    fen() {
      return chess.fen();
    },

    turn,

    /**
     * @returns {Map<string, string[]>} Each square of the player to move,
     *   mapped to the squares its piece can legally reach.
     */
    legalMoves() {
      /** @type {Map<string, string[]>} */
      const targets = new Map();
      for (const { from, to } of chess.moves({ verbose: true })) {
        const tos = targets.get(from) ?? [];
        if (!tos.includes(to)) tos.push(to);
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
      try {
        chess.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci.slice(4) || DEFAULT_PROMOTION,
        });
      } catch (error) {
        return { ok: false, error: error.message };
      }
      return { ok: true, value: chess.fen() };
    },

    status,
  };
}
