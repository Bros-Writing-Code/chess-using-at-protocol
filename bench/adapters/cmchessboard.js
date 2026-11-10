// Library: cm-chessboard (SVG based). npm: cm-chessboard
import { Chessboard } from "cm-chessboard/src/Chessboard.js";

let board;
const full = (p) => p + " w - - 0 1";

export default {
  id: "cmchessboard",
  label: "Library: cm-chessboard",
  async mount(container, placement) {
    board = new Chessboard(container, {
      position: full(placement),
      assetsUrl: "./assets/",
      style: { showCoordinates: false },
    });
    // wait for the piece sprite to load so we time a real render
    if (board.initialized) await board.initialized;
  },
  setPosition(placement) {
    return board.setPosition(full(placement), false); // false = no animation
  },
  destroy() {
    board?.destroy();
  },
};
