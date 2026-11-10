// Library: chessboard.js (jQuery based). npm: @chrisoakman/chessboardjs jquery
// chessboard.js is a global script that expects window.jQuery, so it is loaded lazily here.
import $ from "jquery";
import { GLYPH } from "./glyphs.js";

// The npm package ships no piece images, so use glyph-in-SVG data URIs as the piece set.
// (Piece code is like "wP" / "bK".) Cached so we don't rebuild strings on every render.
const pieceCache = {};
function pieceTheme(piece) {
  const code = piece[0] === "w" ? piece[1] : piece[1].toLowerCase();
  return (pieceCache[piece] ??=
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="50" font-size="80" text-anchor="middle" dominant-baseline="central">${GLYPH[code]}</text></svg>`
    ));
}

let board;
export default {
  id: "chessboardjs",
  label: "Library: chessboard.js (jQuery)",
  async mount(container, placement) {
    window.jQuery = window.$ = $;
    await import("@chrisoakman/chessboardjs/dist/chessboard-1.0.0.js");
    board = window.Chessboard(container, {
      position: placement,
      pieceTheme,
      showNotation: false,
      moveSpeed: 0,
      appearSpeed: 0,
      trashSpeed: 0,
      snapSpeed: 0,
      snapbackSpeed: 0,
      draggable: false,
    });
  },
  setPosition(placement) {
    board.position(placement, false); // false = no animation
  },
  destroy() {
    board?.destroy();
  },
};
