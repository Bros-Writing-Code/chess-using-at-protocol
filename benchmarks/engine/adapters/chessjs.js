import { Chess } from 'chess.js';

export const uciObject = (uci) => ({
  from: uci.slice(0, 2),
  to: uci.slice(2, 4),
  ...(uci[4] ? { promotion: uci[4] } : {}),
});
export const moveUci = (move) => move.from + move.to + (move.promotion || '');
function valid(state, uci) {
  if (typeof uci !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
    return false;
  }
  // Restrict generation to the selected piece; malformed inputs need no search.
  const matches = state
    .moves({ square: uci.slice(0, 2), verbose: true })
    .some((move) => moveUci(move) === uci);
  return matches && !state.isGameOver();
}
export function status(chess) {
  if (chess.isCheckmate()) {
    return { status: 'checkmate', winner: chess.turn() === 'w' ? 'b' : 'w', drawReason: null };
  }
  if (chess.isStalemate()) {
    return { status: 'stalemate', winner: null, drawReason: 'stalemate' };
  }
  let drawReason = null;
  if (chess.isInsufficientMaterial()) {
    drawReason = 'insufficient-material';
  } else if (chess.isDrawByFiftyMoves()) {
    drawReason = 'fifty-move-rule';
  } else if (chess.isThreefoldRepetition()) {
    drawReason = 'threefold-repetition';
  }
  return { status: drawReason ? 'draw' : 'active', winner: null, drawReason };
}
export const chessjs = {
  id: 'chessjs',
  load: (fen) => new Chess(fen),
  fen: (state) => state.fen({ forceEnpassantSquare: true }),
  moves: (state) => (state.isGameOver() ? [] : state.moves({ verbose: true }).map(moveUci)),
  valid,
  status,
  move(state, uci) {
    state.move(uciObject(uci));
    return state;
  },
  replay(moves, fen) {
    const state = new Chess(fen);
    for (const uci of moves) {
      state.move(uciObject(uci));
    }
    return state;
  },
  pgn(pgn) {
    const state = new Chess();
    state.loadPgn(pgn);
    return state;
  },
};
