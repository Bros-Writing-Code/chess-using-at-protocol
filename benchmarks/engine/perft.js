// Public APIs only. chess.js undo is included; ours returns immutable child states.
export function perft(adapter, state, depth) {
  if (depth === 0) {
    return 1;
  }
  // Standard bulk counting: each legal move is one leaf at depth 1.
  // Both libraries use this identical shortcut; no leaf status is evaluated.
  const moves = adapter.moves(state);
  if (depth === 1) {
    return moves.length;
  }
  let nodes = 0;
  for (const uci of moves) {
    const child = adapter.move(state, uci);
    nodes += perft(adapter, child, depth - 1);
    if (adapter.id === 'chessjs') {
      state.undo();
    }
  }
  return nodes;
}
