// Library: Chessground (Lichess). npm: chessground
import { Chessground } from "chessground";

let cg;
export default {
  id: "chessground",
  label: "Library: Chessground",
  mount(container, placement) {
    cg = Chessground(container, {
      fen: placement,
      animation: { enabled: false },
      coordinates: false,
      movable: { free: false },
      draggable: { enabled: false },
    });
  },
  setPosition(placement) {
    cg.set({ fen: placement });
  },
  destroy() {
    cg?.destroy();
  },
};
