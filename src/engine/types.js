/**
 * The color of a chess piece or player.
 *
 * @typedef {'w' | 'b'} Color
 */

/**
 * The type of a chess piece.
 *
 * @typedef {'p' | 'r' | 'n' | 'b' | 'q' | 'k'} PieceType
 */

/**
 * The piece types available for pawn promotion.
 *
 * @typedef {'q' | 'r' | 'b' | 'n'} PromotionType
 */

/**
 * The side on which castling occurs.
 *
 * @typedef {'k' | 'q'} CastlingType
 */

/**
 * A position on the chessboard.
 * Rows and columns are zero-indexed (0-7).
 * Row 0 corresponds to rank 8.
 * Column 0 corresponds to file a.
 *
 * @typedef {Object} Square
 * @property {number} row - Row index (0-7).
 * @property {number} col - Column index (0-7).
 */

/**
 * A chess piece on the board.
 *
 * @typedef {Object} Piece
 * @property {Color} color - Piece color.
 * @property {PieceType} type - Piece type.
 */

/**
 * A chess move.
 *
 * Special moves such as castling and en passant
 * can be determined from the game state.
 *
 * @typedef {Object} Move
 * @property {Square} from - Starting square.
 * @property {Square} to - Destination square.
 * @property {PromotionType} [promotion] - Promotion piece.
 */

/**
 * Castling rights for both players.
 *
 * @typedef {Object} CastlingRights
 * @property {boolean} wKingside - White kingside.
 * @property {boolean} wQueenside - White queenside.
 * @property {boolean} bKingside - Black kingside.
 * @property {boolean} bQueenside - Black queenside.
 */

/**
 * A 128-cell 0x88 chessboard. Each row uses 16 cells: the first eight
 * are squares, and the remaining eight are null padding cells.
 * Empty squares also contain null.
 *
 * @typedef {Array<Piece|null>} Board
 */

/**
 * The current status of a chess game.
 *
 * @typedef {
 *   'active' |
 *   'checkmate' |
 *   'stalemate' |
 *   'draw'
 * } GameStatus
 */

/**
 * The reason a game ended in a draw.
 *
 * @typedef {
 *   'stalemate' |
 *   'insufficient-material' |
 *   'threefold-repetition' |
 *   'fivefold-repetition' |
 *   'fifty-move-rule' |
 *   'seventy-five-move-rule' |
 *   'agreement'
 * } DrawReason
 */

/**
 * A complete chess game state.
 *
 * @typedef {Object} GameState
 * @property {Board} board - Current board position.
 * @property {Color} currentTurn - Player to move.
 * @property {CastlingRights} castlingRights - Castling availability.
 * @property {number|null} enPassantTarget - En passant target as a 0x88 index.
 * @property {number} halfmoveClock - Halfmoves since a pawn move or capture.
 * @property {number} fullmoveNumber - Fullmove counter, starting at 1.
 * @property {Array<Move>} moveHistory - Moves played so far.
 * @property {Array<string>} positionHistory - Position keys for repetition detection.
 * @property {GameStatus} status - Current game status.
 * @property {Color|null} winner - Winning color, or null.
 * @property {DrawReason|null} drawReason - Reason for a draw, or null.
 */

/**
 * A result representing either success or failure.
 *
 * @template T
 * @typedef {{ok: true, value: T} | {ok: false, error: string}} Result
 */

export {};