export const positions = [
  {
    id: 'start',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    depth: 4,
    nodes: 197281,
  },
  {
    id: 'kiwipete',
    fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    depth: 3,
    nodes: 97862,
  },
  { id: 'position3', fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', depth: 3, nodes: 2812 },
  {
    id: 'position4',
    fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    depth: 3,
    nodes: 9467,
  },
  {
    id: 'position5',
    fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    depth: 3,
    nodes: 62379,
  },
];

export const statusCases = [
  { id: 'active', fen: positions[0].fen, expected: 'active' },
  {
    id: 'mate',
    fen: 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
    expected: 'checkmate',
  },
  { id: 'stalemate', fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', expected: 'stalemate' },
  { id: 'material', fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1', expected: 'draw' },
  { id: 'fifty', fen: '4k3/r7/8/8/8/8/R7/4K3 w - - 100 80', expected: 'draw' },
  {
    id: 'repetition',
    moves: ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8'],
    expected: 'draw',
  },
];
