// @ts-check
/** @typedef {'white' | 'black'} ColorName */

const MS_PER_SECOND = 1000;
/** @type {ColorName[]} */
export const COLORS = ['white', 'black'];

/**
 * Creates a chess clock. Time is worked out from timestamps given by `now`,
 * so it stays correct even if nobody asks for it for a while.
 *
 * @param {Object} options
 * @param {number} options.initialSeconds - Time each side starts with.
 * @param {() => number} options.now - Returns the current time in milliseconds.
 */
export function createClock({ initialSeconds, now }) {
  const initialMs = initialSeconds * MS_PER_SECOND;
  const fullTime = () => ({ white: initialMs, black: initialMs });
  let left = fullTime();
  /** @type {ColorName | null} */
  let running = null;
  let startedAt = 0;

  /** Charges the time since the last start to the running side. */
  function charge() {
    if (running) left[running] -= now() - startedAt;
  }

  /**
   * @param {ColorName} color
   * @returns {number} Milliseconds left, never below 0.
   */
  function remaining(color) {
    const elapsed = running === color ? now() - startedAt : 0;
    return Math.max(0, left[color] - elapsed);
  }

  return {
    /**
     * Charges the running side, then counts down for `color`.
     *
     * @param {ColorName} color
     */
    start(color) {
      charge();
      running = color;
      startedAt = now();
    },

    /** Freezes both sides. */
    stop() {
      charge();
      running = null;
    },

    /** Gives both sides full time and stops the clock. */
    reset() {
      left = fullTime();
      running = null;
    },

    remaining,

    /**
     * @returns {ColorName | null} The side that ran out of time.
     */
    flagged() {
      return COLORS.find((color) => remaining(color) === 0) ?? null;
    },
  };
}
