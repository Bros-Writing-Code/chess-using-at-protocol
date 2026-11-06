# Shared language Used withing the project

`Board State`: The physical or spatial arrangement of the pieces across the 64 squares at any exact snapshot in time (who is sitting on which square).

`Game State`:  The complete set of rules and metadata required to know how play proceeds from that board arrangement. This includes whose turn it is, castling rights for both sides, available en passant targets, the half-move clock for the 50-move rule, and move history needed to check for threefold repetition.

`FEN Notation`:

| FEN Component | Value in String | Description |
| :--- | :--- | :--- |
| **Piece Placement** | `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR` | The board layout, starting from Rank 8 down to Rank 1. |
| **Active Color** | `w` | **White** has the next move. |
| **Castling Rights** | `KQkq` | Both sides can castle Kingside (`K`/`k`) and Queenside (`Q`/`q`). |
| **En Passant** | `-` | No square is available for an en passant capture. |
| **Halfmove Clock** | `0` | Number of moves since the last pawn advance or piece capture. |
| **Fullmove Number**| `1` | The game is currently on move 1. |



