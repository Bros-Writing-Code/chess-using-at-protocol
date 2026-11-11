// Library: cm-chessboard (SVG based). npm: cm-chessboard
import { Chessboard } from "cm-chessboard/src/Chessboard.js";

let board;

function spriteLoaded() {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    (function check() {
      const wrapper = document.getElementById("cm-chessboard-sprite");
      if (wrapper && wrapper.childElementCount > 0) return resolve();
      if (performance.now() - start > 5000) return reject(new Error("cm-chessboard sprite did not load (check assets/pieces/standard.svg)"));
      setTimeout(check, 5);
    })();
  });
}
const full = (p) => p + " w - - 0 1";

export default {
  id: "cmchessboard",
  label: "Library: cm-chessboard",
  async mount(container, placement) {
    board = new Chessboard(container, {
      position: full(placement),
      assetsUrl: "./assets/",
      style: { showCoordinates: false, animationDuration: 0 },
    });
    // cm-chessboard fetches its piece sprite with an async XHR (its `initialized` promise
    // resolves immediately), so wait until the sprite is in the page before timing anything.
    await spriteLoaded();
  },
  setPosition(placement) {
    return board.setPosition(full(placement), false); // false = no animation
  },
  destroy() {
    board?.destroy();
  },
};
