// Library: react-chessboard (v4, React 18). npm: react@18 react-dom@18 react-chessboard@4
// Includes React itself in the bundle, which is the real cost of choosing this option.
import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Chessboard } from "react-chessboard";
import { BOARD_PX } from "../harness.js";

let root;
const full = (p) => p + " w - - 0 1";
const view = (placement) =>
  React.createElement(Chessboard, {
    position: full(placement),
    boardWidth: BOARD_PX,
    animationDuration: 0,
    arePiecesDraggable: false,
    showBoardNotation: false,
  });

export default {
  id: "reactchessboard",
  label: "Library: react-chessboard",
  mount(container, placement) {
    root = createRoot(container);
    flushSync(() => root.render(view(placement)));
  },
  setPosition(placement) {
    flushSync(() => root.render(view(placement)));
  },
  destroy() {
    root?.unmount();
  },
};
